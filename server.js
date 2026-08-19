const express = require('express');
const fs = require('fs');
const path = require('path');
const { Readable } = require('stream');
const { createClient } = require('webdav');

const app = express();
const PORT = process.env.PORT || 3100;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, 'servers.json');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ---------- Server config storage ----------
function loadServers() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch (e) {
    return [];
  }
}

function saveServers(servers) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(servers, null, 2));
}

function getClient(server) {
  return createClient(server.url, {
    username: server.username,
    password: server.password,
  });
}

// ---------- API: server list ----------
app.get('/api/servers', (req, res) => {
  const servers = loadServers().map(({ password, ...rest }) => rest);
  res.json(servers);
});

app.post('/api/servers', (req, res) => {
  const { title, host, username, password, port, path: basePath, https } = req.body;
  if (!title || !host || !username || !password) {
    return res.status(400).json({ error: '标题、主机、用户名、密码为必填项' });
  }
  const protocol = https ? 'https' : 'http';
  const hostPart = port ? `${host}:${port}` : host;
  const url = `${protocol}://${hostPart}${basePath || ''}`;

  const servers = loadServers();
  const server = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title,
    host,
    username,
    password,
    port: port || '',
    path: basePath || '',
    https: !!https,
    url,
    createdAt: new Date().toISOString(),
  };
  servers.push(server);
  saveServers(servers);
  const { password: _pw, ...rest } = server;
  res.json(rest);
});

app.delete('/api/servers/:id', (req, res) => {
  const servers = loadServers().filter((s) => s.id !== req.params.id);
  saveServers(servers);
  res.json({ ok: true });
});

// ---------- API: list directory ----------
app.get('/api/servers/:id/list', async (req, res) => {
  const server = loadServers().find((s) => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: '服务器不存在' });
  const dirPath = req.query.path || '/';
  try {
    const client = getClient(server);
    const items = await client.getDirectoryContents(dirPath);
    const result = items.map((it) => ({
      name: it.basename,
      type: it.type, // 'file' | 'directory'
      size: it.size || 0,
      mtime: it.lastmod || null,
      // 规范化路径：确保以 / 开头且不含重复斜杠
      path: ('/' + it.filename).replace(/\/{2,}/g, '/'),
    }));
    res.json({ path: dirPath, items: result });
  } catch (e) {
    res.status(502).json({ error: '无法访问该目录: ' + (e.message || e) });
  }
});

// 路径编码（保留 / 分隔，其余 URL 编码），与前端 encodePath 一致
function encodePath(p) {
  return p.split('/').filter(Boolean).map(encodeURIComponent).join('/');
}

// ---------- API: stream file (with Range support) ----------
// 基于扩展名的 Content-Type（不依赖远程服务器返回的 mime，Safari 对 MP4 的
// Content-Type 很敏感，远程常返回 application/octet-stream 导致播放失败）
const MIME_BY_EXT = {
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.webm': 'video/webm',
  '.mkv': 'video/x-matroska',
  '.mov': 'video/quicktime',
  '.avi': 'video/x-msvideo',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.wav': 'audio/wav',
  '.ogg': 'audio/ogg',
  '.oga': 'audio/ogg',
  '.flac': 'audio/flac',
  '.aac': 'audio/aac',
  '.opus': 'audio/ogg',
};

app.get('/api/servers/:id/stream', async (req, res) => {
  const server = loadServers().find((s) => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: '服务器不存在' });
  const filePath = req.query.path;
  if (!filePath) return res.status(400).json({ error: '缺少文件路径' });

  try {
    const client = getClient(server);
    const stat = await client.stat(filePath);
    const totalSize = stat.size || 0;

    // Parse Range header
    const range = req.headers.range;
    let start = 0;
    let end = totalSize - 1;
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      if (m) {
        if (m[1]) start = parseInt(m[1], 10);
        if (m[2]) end = parseInt(m[2], 10);
        if (isNaN(start) || start > end) {
          return res.status(416).set('Content-Range', `bytes */${totalSize}`).end();
        }
      }
    }

    const chunkSize = end - start + 1;
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_BY_EXT[ext] || stat.mime || 'application/octet-stream';
    res.status(range ? 206 : 200);
    res.set({
      'Content-Type': contentType,
      'Content-Length': chunkSize,
      'Accept-Ranges': 'bytes',
      'Content-Disposition': `inline; filename="${encodeURIComponent(path.basename(filePath))}"`,
    });
    if (range) {
      res.set('Content-Range', `bytes ${start}-${end}/${totalSize}`);
    }

    // 直接用 Node 内置 fetch（undici）流式代理远程文件。
    // 注意：webdav 库的 createReadStream 底层用 node-fetch，其 Range 头处理有
    // bug（实测带 Range 请求会返回 200 全量、甚至挂起），导致每次请求都下载整个
    // 文件——播放慢且 Safari 判定响应损坏播放失败。这里绕开它。
    const remoteURL = server.url + '/' + encodePath(filePath);
    const upstream = await fetch(remoteURL, {
      headers: {
        Authorization: 'Basic ' + Buffer.from(`${server.username}:${server.password}`).toString('base64'),
        ...(range ? { Range: `bytes=${start}-${end}` } : {}),
      },
    });
    if (!upstream.ok && upstream.status !== 206) {
      if (!res.headersSent) return res.status(502).json({ error: '远程读取失败: HTTP ' + upstream.status });
      return res.destroy();
    }
    const body = Readable.fromWeb(upstream.body);
    body.on('error', (err) => {
      if (!res.headersSent) res.status(502).json({ error: '读取文件失败: ' + err.message });
      else res.destroy();
    });
    body.pipe(res);
  } catch (e) {
    res.status(502).json({ error: '无法读取文件: ' + (e.message || e) });
  }
});

// ---------- API: subtitle (SRT/VTT proxy for <track>) ----------
// SRT 时间戳 00:00:01,000 --> 00:00:02,500 转为 VTT 的 00:00:01.000 --> 00:00:02.500
// 注入 STYLE 块：强制字幕底部居中（iOS Safari 有时默认偏右）
const VTT_STYLE = 'STYLE\n::cue {\n  text-align: center;\n  font-size: 1.05em;\n  background: rgba(0,0,0,0.75);\n}\n\n';

function srtToVtt(text) {
  let t = String(text).replace(/^\uFEFF/, '');
  // 已是 WebVTT 则直接返回（透传，不重复注入样式）
  if (/^\s*WEBVTT\b/i.test(t)) return t;
  // 去掉可能残留的序号块头、统一换行
  t = t.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  // 时间戳逗号转点号
  t = t.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2');
  return 'WEBVTT\n\n' + VTT_STYLE + t.trim() + '\n';
}

app.get('/api/servers/:id/subtitle', async (req, res) => {
  const server = loadServers().find((s) => s.id === req.params.id);
  if (!server) return res.status(404).json({ error: '服务器不存在' });
  const filePath = req.query.path;
  if (!filePath) return res.status(400).json({ error: '缺少文件路径' });
  const ext = path.extname(filePath).toLowerCase();
  if (!['.srt', '.vtt'].includes(ext)) {
    return res.status(415).json({ error: '不支持的字幕格式: ' + (ext || '未知') });
  }

  try {
    const client = getClient(server);
    const chunks = [];
    const stream = client.createReadStream(filePath);
    stream.on('error', (err) => {
      if (!res.headersSent) res.status(502).json({ error: '读取字幕失败: ' + err.message });
      else res.destroy();
    });
    stream.on('data', (c) => chunks.push(c));
    stream.on('end', () => {
      let text = Buffer.concat(chunks).toString('utf8');
      if (ext === '.srt') {
        text = srtToVtt(text);
      } else {
        // 透传 .vtt：若无 STYLE 块则注入居中样式（不覆盖原有样式）
        text = text.replace(/^\uFEFF/, '');
        if (/^\s*WEBVTT\b/i.test(text) && !/^\s*STYLE\b/im.test(text)) {
          text = text.replace(/^\s*WEBVTT\b[^\n]*\n/i, (m) => m + '\n' + VTT_STYLE);
        }
      }
      res.set('Content-Type', 'text/vtt; charset=utf-8');
      res.set('Cache-Control', 'no-cache');
      res.send(text);
    });
  } catch (e) {
    res.status(502).json({ error: '无法读取字幕: ' + (e.message || e) });
  }
});

app.listen(PORT, () => {
  console.log(`WebDAV Player running at http://localhost:${PORT}`);
});

// SPA catch-all：非 /api 的前端路由回退到 index.html，支持浏览器历史/前进后退
app.get(/^(?!\/api\/).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

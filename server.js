const express = require('express');
const fs = require('fs');
const path = require('path');
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
      path: it.filename,
    }));
    res.json({ path: dirPath, items: result });
  } catch (e) {
    res.status(502).json({ error: '无法访问该目录: ' + (e.message || e) });
  }
});

// ---------- API: stream file (with Range support) ----------
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
    res.status(range ? 206 : 200);
    res.set({
      'Content-Type': stat.mime || 'application/octet-stream',
      'Content-Length': chunkSize,
      'Accept-Ranges': 'bytes',
      'Content-Disposition': `inline; filename="${encodeURIComponent(path.basename(filePath))}"`,
    });
    if (range) {
      res.set('Content-Range', `bytes ${start}-${end}/${totalSize}`);
    }

    const stream = client.createReadStream(filePath, { start, end });
    stream.on('error', (err) => {
      if (!res.headersSent) res.status(502).json({ error: '读取文件失败: ' + err.message });
      else res.destroy();
    });
    stream.pipe(res);
  } catch (e) {
    res.status(502).json({ error: '无法读取文件: ' + (e.message || e) });
  }
});

app.listen(PORT, () => {
  console.log(`WebDAV Player running at http://localhost:${PORT}`);
});

// SPA catch-all：非 /api 的前端路由回退到 index.html，支持浏览器历史/前进后退
app.get(/^(?!\/api\/).*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

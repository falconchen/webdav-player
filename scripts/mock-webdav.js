// 极简 WebDAV mock（仅测试用）：支持 PROPFIND 列目录 + GET 读文件
// 用法: node mock-webdav.js <port> <rootDir>
const http = require('http');
const fs = require('fs');
const path = require('path');

const port = parseInt(process.argv[2] || '3999', 10);
const root = path.resolve(process.argv[3] || './mock-data');

function toUrlPath(p) {
  return p.split(path.sep).join('/');
}

function xmlEscape(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function propfindXml(urlPath, absPath) {
  const st = fs.statSync(absPath);
  let responses = '';
  if (st.isDirectory()) {
    for (const name of fs.readdirSync(absPath)) {
      const childAbs = path.join(absPath, name);
      const childUrl = (urlPath === '/' ? '/' : urlPath + '/') + encodeURIComponent(name);
      const cst = fs.statSync(childAbs);
      responses += `<response>
        <href>${childUrl}</href>
        <propstat><prop>
          <displayname>${xmlEscape(name)}</displayname>
          <resourcetype>${cst.isDirectory() ? '<collection/>' : ''}</resourcetype>
          <getcontentlength>${cst.size}</getcontentlength>
          <getlastmodified>${cst.mtime.toUTCString()}</getlastmodified>
        </prop><status>HTTP/1.1 200 OK</status></propstat>
      </response>`;
    }
  } else {
    responses += `<response>
      <href>${urlPath}</href>
      <propstat><prop>
        <displayname>${xmlEscape(path.basename(absPath))}</displayname>
        <resourcetype></resourcetype>
        <getcontentlength>${st.size}</getcontentlength>
        <getlastmodified>${st.mtime.toUTCString()}</getlastmodified>
      </prop><status>HTTP/1.1 200 OK</status></propstat>
    </response>`;
  }
  return `<?xml version="1.0" encoding="utf-8"?>
<D:multistatus xmlns:D="DAV:">${responses}</D:multistatus>`;
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://x');
  const urlPath = decodeURIComponent(url.pathname);
  const abs = path.join(root, urlPath.replace(/^\//, ''));

  if (req.method === 'PROPFIND') {
    if (!fs.existsSync(abs)) { res.writeHead(404); res.end(); return; }
    res.writeHead(207, { 'Content-Type': 'application/xml; charset=utf-8' });
    res.end(propfindXml(urlPath, abs));
    return;
  }

  if (req.method === 'GET' || req.method === 'HEAD') {
    if (!fs.existsSync(abs) || fs.statSync(abs).isDirectory()) { res.writeHead(404); res.end(); return; }
    const st = fs.statSync(abs);
    const range = req.headers.range;
    let start = 0, end = st.size - 1;
    if (range) {
      const m = /bytes=(\d*)-(\d*)/.exec(range);
      if (m) { if (m[1]) start = parseInt(m[1], 10); if (m[2]) end = parseInt(m[2], 10); }
    }
    res.writeHead(range ? 206 : 200, {
      'Content-Type': 'application/octet-stream',
      'Content-Length': end - start + 1,
      'Accept-Ranges': 'bytes',
      ...(range ? { 'Content-Range': `bytes ${start}-${end}/${st.size}` } : {}),
    });
    if (req.method === 'HEAD') { res.end(); return; }
    const stream = fs.createReadStream(abs, { start, end });
    stream.pipe(res);
    return;
  }

  res.writeHead(501); res.end();
});

server.listen(port, () => console.log(`mock webdav on :${port} root=${root}`));

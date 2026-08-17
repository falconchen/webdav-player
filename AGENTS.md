# AGENTS.md

本文件为 AI 编码代理（及后续维护者）提供项目上下文与开发约定，供后续迭代参考。

## 项目概览

- **名称**：WebDAV 播放器
- **定位**：代理式 WebDAV 媒体播放器，播放远程服务器上的 MP3 / MP4
- **技术栈**：Node.js + Express + `webdav` 库；前端为原生单页应用（无构建步骤）
- **默认端口**：3100（可用 `PORT` 环境变量覆盖）

## 关键文件

| 文件 | 职责 |
|------|------|
| `server.js` | Express 后端：服务器配置 CRUD + WebDAV 代理（列表/流式播放） |
| `public/index.html` | 单页前端：服务器列表 / 新建 / 文件列表 / 播放器 |
| `public/video-poster.png` | 视频默认封面（16:9），`<video>` 的 poster 属性引用 |
| `scripts/gen-poster.py` | 重新生成默认封面（依赖 python3 + Pillow） |
| `Dockerfile` | 多阶段构建镜像（node:22-alpine，非 root 运行） |
| `docker-compose.yml` | Compose 编排：3100 端口、`./data` 数据卷持久化 |
| `servers.json` | 运行时生成的用户配置存储（**已 gitignore，勿提交**） |
| `package.json` | 依赖与启动脚本 |

## 架构要点

- **代理式**：浏览器 → 本服务 → 用户 WebDAV 服务器，数据经本服务中转
- **流式播放**：`/api/servers/:id/stream` 通过 `webdav` 的 `createReadStream` 转发，支持 HTTP Range（206），实现进度拖动与断点续播
- **配置存储**：`loadServers()` / `saveServers()` 读写 `servers.json`，密码明文存储

## 开发约定

1. **不要提交 `servers.json`**：内含用户 WebDAV 明文凭据，已在 `.gitignore` 中排除。
2. **端口**：默认 3100；3000 常被其他服务占用，勿改回 3000。
3. **前端无构建**：直接改 `public/index.html`，刷新即可生效，无需打包。
4. **新增 API**：遵循现有 `/api/servers/:id/...` 风格，返回 JSON，错误用 `{ error: string }` + 4xx/5xx 状态码。
5. **媒体类型**：音频/视频扩展名判断集中在 `public/index.html` 的 `AUDIO_EXT` / `VIDEO_EXT`，新增格式在此维护。
6. **视频默认封面**：`public/video-poster.png` 由 `<video poster>` 引用；如需重新生成，运行 `python3 scripts/gen-poster.py`（依赖 python3 + Pillow）。封面为静态资源，不依赖 ffmpeg。
7. **Docker 构建**：`docker compose up -d --build`；容器内 `DATA_FILE=/app/data/servers.json`，宿主机数据在 `./data/`（已 gitignore）。修改 `server.js`/`public/` 后需重建镜像。

## 已知限制 / 待办

- 密码明文存储，无加密
- 后端无鉴权，仅适合内网/本机
- 代理式架构消耗本服务带宽
- 详见 `README.md` 的「后续迭代方向」

## 运行与测试

```bash
npm install
npm start            # 默认 3100
# 手动验证
curl http://localhost:3100/api/servers
curl -X POST http://localhost:3100/api/servers -H "Content-Type: application/json" \
  -d '{"title":"t","host":"example.com","username":"u","password":"p","https":true}'
```

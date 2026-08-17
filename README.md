# WebDAV 播放器

一个基于 Node.js 的 WebDAV 媒体播放器，用于播放远程 WebDAV 服务器上的 MP3 / MP4 等音视频文件。

## 功能特性

- **服务器列表**：管理多个 WebDAV 服务器，支持删除
- **新建服务器**：配置标题、主机、用户名、密码、端口（可选）、路径（可选）、HTTPS
- **文件列表**：进入服务器后浏览目录与文件，带面包屑导航
- **媒体播放**：点击音频/视频文件即播放，支持 HTTP Range 断点续播与进度拖动
- **播放进度记忆**：记住每个文件的播放位置（localStorage），再次打开自动恢复并提示；看完自动清除
- **视频字幕**：自动识别视频同目录下的 `.srt` / `.vtt` 字幕文件，支持多语言切换与关闭（无字幕时隐藏）
- **视频默认封面**：视频播放前/加载期间显示内置默认封面（16:9），无需 ffmpeg

## 架构

本项目采用**代理式**架构：浏览器不直接连接用户的 WebDAV 服务器，所有请求先到达本服务，由后端通过 `webdav` 库访问远程服务器并转发结果。

```
用户浏览器 ──HTTP──▶ 本服务(3100) ──WebDAV──▶ 用户的 WebDAV 服务器
```

## 技术栈

- **后端**：Node.js + Express + [webdav](https://www.npmjs.com/package/webdav)
- **前端**：原生 HTML / CSS / JavaScript（单页应用，无构建步骤）

## 快速开始

```bash
# 安装依赖
npm install

# 启动（默认端口 3100）
npm start

# 或指定端口
PORT=8080 npm start
```

启动后访问：<http://localhost:3100>

## Docker 部署

### 方式一：docker compose（推荐）

```bash
# 构建并启动（后台运行）
docker compose up -d --build

# 查看日志
docker compose logs -f

# 停止
docker compose down
```

- 默认映射宿主机 **3100** 端口，访问 <http://localhost:3100>
- 服务器配置持久化在宿主机 `./data/servers.json`（容器内 `/app/data`），重建容器不丢失
- 容器以非 root 用户运行；`restart: unless-stopped` 保证开机/崩溃自启

### 方式二：直接构建运行

```bash
docker build -t webdav-player .
docker run -d --name webdav-player \
  -p 3100:3100 \
  -v "$PWD/data:/app/data" \
  webdav-player
```

### 配置项

| 环境变量 | 默认值 | 说明 |
|----------|--------|------|
| `PORT` | `3100` | 服务端口 |
| `DATA_FILE` | `/app/data/servers.json` | 服务器配置存储路径（本地默认为 `servers.json`） |

## 项目结构

```
webdav-player/
├── server.js          # Express 后端：配置存储 + WebDAV 代理
├── Dockerfile         # 多阶段构建镜像（node:22-alpine）
├── docker-compose.yml # Compose 编排（端口、数据卷、自动重启）
├── public/
│   ├── index.html     # 单页前端（列表/新建/文件/播放器）
│   └── video-poster.png  # 视频默认封面
├── scripts/
│   └── gen-poster.py  # 封面再生成脚本（python3 + Pillow）
├── package.json
├── servers.json       # 运行时生成：用户 WebDAV 配置（已 gitignore）
└── .gitignore
```

## API 概览

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/servers` | 服务器列表 |
| POST | `/api/servers` | 新建服务器 |
| DELETE | `/api/servers/:id` | 删除服务器 |
| GET | `/api/servers/:id/list?path=/` | 列出目录内容 |
| GET | `/api/servers/:id/stream?path=/x.mp4` | 流式播放文件（支持 Range） |
| GET | `/api/servers/:id/subtitle?path=/x.srt` | 字幕代理（SRT 自动转 WebVTT） |

## 安全说明

> ⚠️ **当前为演示/内网用途，请勿直接暴露到公网。**

- 用户 WebDAV 的**用户名和密码以明文**保存在 `servers.json`（已加入 `.gitignore`，不会提交到仓库）
- 后端**无鉴权**，任何能访问本服务的人都能读取/操作已配置的服务器
- 建议仅在内网或本机使用；如需公网部署，请自行增加认证与加密存储

## 后续迭代方向

- [ ] 密码加密存储（如 AES / 环境变量密钥）
- [ ] 后端访问鉴权（登录 / Token）
- [ ] 直连式架构（前端直接连 WebDAV，省带宽）
- [ ] 播放列表 / 断点记忆
- [ ] 更多媒体格式与字幕支持

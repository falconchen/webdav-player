# ---- Build stage ----
FROM node:22-alpine AS build

WORKDIR /app

# 先复制依赖清单，利用 Docker 层缓存
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

# ---- Runtime stage ----
FROM node:22-alpine

WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3100
ENV DATA_FILE=/app/data/servers.json

# 复制依赖与源码
COPY --from=build /app/node_modules ./node_modules
COPY . .

# su-exec：entrypoint 中降权用
RUN apk add --no-cache su-exec

# 数据目录（servers.json 持久化）
RUN mkdir -p /app/data

# 非 root 运行
RUN addgroup -S app && adduser -S app -G app && chown -R app:app /app && chmod +x /app/entrypoint.sh

EXPOSE 3100

ENTRYPOINT ["/app/entrypoint.sh"]

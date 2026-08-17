#!/bin/sh
set -e

# 确保数据目录存在且归 app 用户所有（bind mount 的宿主机目录初始属主可能是 root）
mkdir -p /app/data
chown -R app:app /app/data

# 降权运行应用
exec su-exec app node server.js

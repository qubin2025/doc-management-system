# 全过程工程咨询管理系统 — 多阶段构建
# 注意: better-sqlite3 是原生模块，必须用 Node v22 编译（NODE_MODULE_VERSION 127）
# Stage 1: 前端构建
FROM node:22-alpine AS frontend-build
WORKDIR /app
COPY package*.json ./
RUN npm ci --production=false
COPY . .
RUN npm run build

# Stage 2: 后端依赖构建（含 better-sqlite3 原生模块编译）
FROM node:22-alpine AS backend-build
WORKDIR /app
# better-sqlite3 编译需要 python3 + make + g++
RUN apk add --no-cache python3 make g++
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --production

# Stage 3: 生产运行（精简镜像，不含编译工具链）
FROM node:22-alpine
WORKDIR /app

# 复制已编译的 node_modules（含 better-sqlite3 原生模块）
COPY --from=backend-build /app/backend/node_modules ./backend/node_modules

# 复制后端代码
COPY backend/ ./backend/

# 复制前端构建产物
COPY --from=frontend-build /app/dist ./dist

# 数据目录
RUN mkdir -p /app/backend/data /app/backend/files /app/logs

# 环境变量（运行时可在 docker-compose 中覆盖）
ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/backend/data/planning.db
ENV FILES_PATH=/app/backend/files
ENV LOG_PREFIX_DOC_LIST=DOC-LIST
ENV LOG_PREFIX_DOC_DOWNLOAD=DOC-DL
ENV LOG_ENV_TAG=PROD

EXPOSE 3000

# 生产模式启动（大内存用于 PDF 解析）
CMD ["node", "--max-old-space-size=4096", "backend/server.js"]

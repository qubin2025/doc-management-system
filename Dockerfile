# 全过程工程咨询管理系统 — 多阶段构建
# Stage 1: 前端构建
FROM node:18-alpine AS frontend-build
WORKDIR /app
COPY package*.json ./
RUN npm ci --production=false
COPY . .
RUN npm run build

# Stage 2: 生产运行
FROM node:18-alpine
WORKDIR /app

# 后端依赖
COPY backend/package*.json ./backend/
RUN cd backend && npm ci --production

# 复制后端代码
COPY backend/ ./backend/

# 复制前端构建产物
COPY --from=frontend-build /app/dist ./dist

# 数据目录
RUN mkdir -p /app/backend/data /app/backend/files /app/logs

ENV NODE_ENV=production
ENV PORT=3000
EXPOSE 3000

CMD ["node", "backend/server.js"]

# 全过程工程咨询管理系统

面向建设工程全过程咨询的工程资料管理系统，支持建筑（DB11/T695-2025）和市政（DB11/T808-2020）双规程。

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React 18 + TypeScript 5 + Vite 5 + TailwindCSS 3 |
| 后端 | Express 4 + better-sqlite3 |
| AI | DeepSeek (聊天) + 通义 (Embedding) + GLM-4V (视觉) |
| 部署 | Docker / PM2 + Nginx |

## 快速启动

### 方式一：Docker（推荐）

```bash
cp backend/.env.example backend/.env   # 编辑填入 API Keys
docker-compose up -d
```

访问 `http://localhost`

### 方式二：手动启动

```bash
# 后端
cd backend
cp .env.example .env    # 编辑填入 API Keys 和 JWT_SECRET
npm install
node server.js

# 前端（新终端）
cd ..
cp .env.example .env    # 编辑 API 地址
npm install
npm run dev
```

访问 `http://localhost:5173`

## 默认账号

首次部署后，系统自动创建 `admin` 用户，密码需通过脚本设置（见 `deploy/安全交付清单.md`）。

## 部署文档

- [部署说明（详细版）](部署说明.md)
- [快速部署](DEPLOY.md)
- [安全交付清单](deploy/安全交付清单.md)
- [Docker 部署](deploy/README.md)

## 项目结构

```
├── src/                    # 前端源码
│   ├── components/         # React 组件
│   ├── data/               # 数据层（API、引擎、知识图谱）
│   └── types/              # TypeScript 类型定义
├── backend/                # 后端源码
│   ├── routes/             # API 路由
│   ├── middleware/         # 认证中间件
│   └── data/               # SQLite 数据库
├── deploy/                 # 部署脚本和配置
├── docker-compose.yml      # Docker 编排
└── Dockerfile              # Docker 镜像构建
```

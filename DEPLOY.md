# 工程资料管理系统 — 开发文档

## 版本历史

| 版本 | 日期 | 内容 |
|------|------|------|
| v1.0.0 | 2026-05-16 | 首个可用版本：建筑+市政双规程资料管理 |
| v1.5.0 | 2026-05-17 | Phase 2：登录权限系统 + AI集成 + 首页框架 + 数据备份 |
| v1.6.0 | 2026-05-17 | 首页确立：指南工作模块 + 功能模块统一布局 |

## v1.6.0 首页框架

### 第一区块：指南工作模块
| 序号 | 模块 | 状态 |
|------|------|------|
| 第一章 | 前期工作 | 规划中 |
| 第二章 | 招标采购 | 规划中 |
| 第三章 | 工程施工 | 规划中 |
| 第四章 | 竣工验收及移交 | 规划中 |

### 第二区块：功能模块
| 模块 | 说明 | 状态 |
|------|------|------|
| 工程资料管理 | DB11/T 695-2025 & DB11/T 808-2020 附录A | 已上线 |
| 知识库 | 文档规范沉淀，可检索知识资产 | 规划中 |
| 供应商库 | 供应商管理、资质审核、资源池 | 规划中 |
| 计划管理 | 甘特图、双代号网络图、进度计划 | 规划中 |
| 造价数据 | 工程量清单、定额指标、成本数据库 | 规划中 |
| 智能分析 | 大模型驱动分析、数字资产形成 | 规划中 |

## 技术架构

### 前端
- React 18 + TypeScript + Vite 5 + Tailwind CSS 3
- Lucide React 图标库
- JSZip（前端打包下载）

### 后端
- Node.js + Express.js
- SQLite（better-sqlite3）
- bcrypt 密码哈希
- UUID Session 鉴权
- 文件磁盘存储（FILES_PATH）

### 权限角色
| 角色 | 权限 |
|------|------|
| admin | 全部权限 |
| project_manager | 上传/下载/使用AI |
| construction_unit | 上传/下载（无AI） |
| viewer | 上传/下载（无AI） |

### 部署目标
公司 Windows Server（D:\doc-system\）

---

## 当前状态
- 前端：React 18 + Vite，编译后为静态文件（dist/）
- 后端：Node.js + Express + SQLite（backend/）
- 数据库：SQLite 单文件（planning.db）
- 代码仓库：github.com/qubin2025/doc-management-system

---

## 周一部署步骤

### 第1步：环境准备（预计 30 分钟）

**在 Windows Server 上安装：**

1. **Node.js v22**
   - 下载：https://nodejs.org/dist/v22.16.0/node-v22.16.0-x64.msi
   - 安装后验证：`node --version` → v22.16.0

2. **PM2（进程守护）**
   - 打开 PowerShell（管理员）：
   ```bash
   npm install -g pm2
   pm2 startup

   ```

3. **IIS 或 Nginx（Web 服务器）**
   - 如果公司已有 IIS，使用 IIS 托管前端静态文件
   - 或者安装 Nginx for Windows

### 第2步：部署后端 API（预计 30 分钟）

1. 将 `backend/` 目录复制到服务器，例如 `D:\doc-system\backend\`
2. 安装依赖：
   ```bash
   cd D:\doc-system\backend
   npm install --production
   ```
3. 创建数据目录：
   ```bash
   mkdir D:\doc-system\backend\data
   ```
4. 启动服务（使用 PM2）：
   ```bash
   pm2 start server.js --name doc-api
   pm2 save
   ```
5. 验证：`curl http://localhost:3000/api` → 应返回 `{"status":"ok"}`

### 第3步：部署前端（预计 20 分钟）

1. 在本地构建前端：
   ```bash
   cd C:\Users\X1 隐士\Desktop\工程资料管理系统源码
   # 修改 .env.production 中的 VITE_API_URL 指向服务器地址
   echo VITE_API_URL=http://服务器IP:3000/api > .env.production
   npm run build
   ```
2. 将 `dist/` 目录复制到服务器 `D:\doc-system\frontend\`
3. 配置 IIS 指向 `D:\doc-system\frontend\` 目录
4. 或使用 Nginx：复制 `nginx.conf` 配置指向前端目录

### 第4步：配置防火墙

- 开放端口 `3000`（后端 API）
- 开放端口 `80`（前端 Web）

### 第5步：数据迁移

- 从本机导出当前数据（如有）：
  ```bash
  curl http://localhost:3000/api/backup/export > backup.json
  ```
- 在服务器导入：
  ```bash
  curl -X POST http://服务器IP:3000/api/import -H "Content-Type: application/json" -d @backup.json
  ```

### 第6步：内网测试

- 前端地址：`http://服务器IP/`
- 后端 API：`http://服务器IP:3000/api`
- 管理员登录：`admin` / `admin123`

---

## 数据备份方案

### 自动备份（建议每周一次）

创建 `backup.bat` 脚本，加入 Windows 任务计划：

```batch
@echo off
set BACKUP_DIR=D:\doc-system\backups
set DATE=%date:~0,4%%date:~5,2%%date:~8,2%
mkdir %BACKUP_DIR% 2>nul
copy D:\doc-system\backend\data\planning.db %BACKUP_DIR%\planning_%DATE%.db
echo Backup completed: %DATE%
```

### 数据库路径
- 开发环境：`backend/data/planning.db`
- 服务器：`D:\doc-system\backend\data\planning.db`

---

## 版本更新流程

日常更新代码后，按以下步骤发布新版本：

```bash
# 1. 本地修改代码并测试
cd C:\Users\X1 隐士\Desktop\工程资料管理系统源码
npm run build

# 2. 提交到 GitHub
git add -A
git commit -m "描述你的改动"
git push origin master

# 3. 复制到服务器
# 前端：dist/ → 服务器 D:\doc-system\frontend\
# 后端如有改动：backend/ → 服务器 D:\doc-system\backend\ （然后 pm2 restart doc-api）
```

### 快捷更新脚本（可选）

创建 `deploy.bat`（在本地运行）：
```batch
@echo off
echo Building...
call npm run build
echo Copying to server...
xcopy /E /Y dist\*.* \\服务器IP\doc-system\frontend\
echo Done!
```

---

## 注意事项

1. **SQLite 并发**：SQLite 不适合高并发写入，建议 10 人以内使用流畅
2. **文件上传限制**：前端限制 50MB，后端限制 100MB
3. **管理员密码**：部署后立即修改默认密码
4. **防火墙**：只对内网开放，不要暴露到公网
5. **备份**：定期备份 planning.db 文件

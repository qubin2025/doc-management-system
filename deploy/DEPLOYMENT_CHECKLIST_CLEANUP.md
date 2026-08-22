# 日报清理任务部署检查清单

**版本**: v1.0
**更新日期**: 2026-08-21
**适用环境**: Linux 生产服务器
**相关文件**:
- [backend/scripts/cleanup-daily-uploads.js](file:///d:/AICODING0609/工程资料管理系统源码/backend/scripts/cleanup-daily-uploads.js) - 主清理脚本
- [backend/lib/feishuAlert.js](file:///d:/AICODING0609/工程资料管理系统源码/backend/lib/feishuAlert.js) - 飞书告警模块
- [deploy/ecosystem.config.cjs](file:///d:/AICODING0609/工程资料管理系统源码/deploy/ecosystem.config.cjs) - PM2 配置

---

## 一、前置条件检查

### 1.1 服务器环境

- [ ] Node.js ≥ 18.0.0（需支持原生 `fetch` 和 ES Modules）
  ```bash
  node --version
  ```
- [ ] PM2 已全局安装
  ```bash
  npm install -g pm2
  pm2 --version
  ```
- [ ] 项目代码已部署到 `/opt/doc-mgmt`（或目标路径）
- [ ] 后端依赖已安装
  ```bash
  cd /opt/doc-mgmt/backend && npm install --omit=dev
  ```
- [ ] `backend/files/daily-uploads/` 目录存在（若不存在，脚本首次运行会自动跳过）

### 1.2 文件完整性

- [ ] `backend/scripts/cleanup-daily-uploads.js` 已上传（191 行）
- [ ] `backend/lib/feishuAlert.js` 已上传（91 行）
- [ ] `deploy/ecosystem.config.cjs` 已更新（含 4 个应用）
- [ ] `backend/logs/` 目录已创建（PM2 日志写入位置）
  ```bash
  mkdir -p /opt/doc-mgmt/backend/logs
  ```

### 1.3 数据库文件

- [ ] `backend/data/planning.db` 存在且可读写
- [ ] `daily_reports` 表已存在（v5.4 知识库同步依赖）

---

## 二、PM2 配置验证

### 2.1 配置语法检查

- [ ] ecosystem.config.cjs 语法正确
  ```bash
  cd /opt/doc-mgmt
  node -e "require('./deploy/ecosystem.config.cjs')"
  ```

### 2.2 应用列表确认

- [ ] 配置文件包含 4 个应用：
  - [ ] `doc-mgmt-backend` — 主服务常驻
  - [ ] `cleanup-daily-uploads` — cron `0 4 * * *`
  - [ ] `cleanup-sessions` — cron `0 3 * * *`
  - [ ] `backup-db` — cron `0 2 * * *`

### 2.3 环境变量配置

- [ ] **必填** `FILES_PATH: './files'` — 文件根目录
- [ ] **必填** `KEEP_DAYS: 7` — 保留天数
- [ ] **可选** `FEISHU_WEBHOOK_URL` — 飞书告警 webhook（留空则跳过告警）
- [ ] **可选** `FEISHU_ALERT_LEVEL: 'error'` — 告警级别
- [ ] **可选** `ALERT_HOSTNAME` — 告警显示主机名（留空用 os.hostname）

---

## 三、飞书告警配置（可选）

### 3.1 创建飞书自定义机器人

1. 打开飞书群 → 群设置 → 群机器人 → 添加机器人 → **自定义机器人**
2. 填写机器人名称（如"运维告警"）和描述
3. **安全设置**（推荐）选择"自定义关键词"，关键词填 `日报清理任务` 或 `运维告警`
4. 复制 webhook URL（格式：`https://open.feishu.cn/open-apis/bot/v2/hook/xxxxxxxx`）
5. 保存并记录 webhook URL

### 3.2 配置 PM2 环境变量

编辑 `deploy/ecosystem.config.cjs`：

```javascript
env: {
  NODE_ENV: 'production',
  FILES_PATH: './files',
  KEEP_DAYS: 7,
  FEISHU_WEBHOOK_URL: 'https://open.feishu.cn/open-apis/bot/v2/hook/xxxxxxxx',
  FEISHU_ALERT_LEVEL: 'error',    // error=仅失败告警 / always=每次执行 / never=禁用
  ALERT_HOSTNAME: 'prod-server-01',
},
```

### 3.3 告警触发规则

| 级别 | 触发条件 | 用途 |
|------|---------|------|
| `error`（默认） | exitCode ≠ 0 | 仅在脚本失败/部分失败时告警 |
| `always` | 每次执行 | 调试期监控，便于观察运行情况 |
| `never` | 永不告警 | 临时禁用告警 |

### 3.4 告警消息格式

飞书接收到的卡片消息包含：
- **标题**: ✅/🔴 日报清理任务 - SUCCESS/FAILED/PARTIAL_FAILED
- **主机**: 服务器主机名
- **时间**: ISO 时间戳
- **耗时**: 执行秒数
- **退出码**: 0/1/2
- **扫描/删除/跳过/释放空间/错误数**: 统计信息
- **错误详情**: 前 10 个错误（仅失败时）
- **备注**: KEEP_DAYS, DRY_RUN 配置

---

## 四、部署步骤

### 4.1 备份现有 PM2 配置

```bash
pm2 save
cp ~/.pm2/dump.pm2 ~/dump.pm2.bak.$(date +%Y%m%d)
```

### 4.2 停止旧应用

```bash
pm2 delete doc-mgmt-backend 2>/dev/null || true
pm2 delete cleanup-daily-uploads 2>/dev/null || true
pm2 delete cleanup-sessions 2>/dev/null || true
pm2 delete backup-db 2>/dev/null || true
```

### 4.3 加载新配置

```bash
cd /opt/doc-mgmt
pm2 start deploy/ecosystem.config.cjs
pm2 save
pm2 startup    # 按提示执行返回的 sudo 命令
```

### 4.4 验证应用状态

- [ ] `pm2 status` 显示 4 个应用
  - [ ] `doc-mgmt-backend` 状态为 `online`
  - [ ] 其他 3 个状态为 `stopped`（等待 cron 触发，正常）

```bash
pm2 status
```

预期输出：
```
┌────┬─────────────────────────┬─────────────┬──────┬───────────┐
│ id │ name                    │ namespace   │ mode │ status    │
├────┼─────────────────────────┼─────────────┼──────┼───────────┤
│ 0  │ doc-mgmt-backend        │ default     │ fork │ online    │
│ 1  │ cleanup-daily-uploads   │ default     │ fork │ stopped   │
│ 2  │ cleanup-sessions       │ default     │ fork │ stopped   │
│ 3  │ backup-db               │ default     │ fork │ stopped   │
└────┴─────────────────────────┴─────────────┴──────┴───────────┘
```

---

## 五、手动测试

### 5.1 预演模式测试（不删除任何文件）

```bash
cd /opt/doc-mgmt/backend
DRY_RUN=1 KEEP_DAYS=30 node scripts/cleanup-daily-uploads.js
```

- [ ] 日志输出包含 `[init]` 配置信息
- [ ] 日志输出包含 `[scan]` 目录读取结果
- [ ] 日志输出包含 `[loop]` 每个文件的决策（前 5 个 + 每 50 个）
- [ ] 日志输出包含 `[summary]` 汇总统计
- [ ] 日志输出包含 `[summary]` age distribution 年龄分布
- [ ] 日志输出包含 `[done]` 总耗时和退出码
- [ ] 退出码为 0
- [ ] 实际文件未被删除（用 `ls files/daily-uploads/ | wc -l` 对比）

### 5.2 实际删除测试

```bash
cd /opt/doc-mgmt/backend
node scripts/cleanup-daily-uploads.js
```

- [ ] 退出码为 0（成功）或 2（部分失败，需检查错误详情）
- [ ] `files/daily-uploads/` 目录下过期文件已删除
- [ ] 保留期内文件仍然存在

### 5.3 PM2 触发测试

```bash
pm2 start cleanup-daily-uploads
pm2 logs cleanup-daily-uploads --lines 30
```

- [ ] PM2 能正确启动应用
- [ ] 日志能写入 `backend/logs/cleanup-daily-out.log`
- [ ] 执行完毕后状态变为 `stopped`

### 5.4 飞书告警测试（如已配置）

```bash
cd /opt/doc-mgmt/backend
FEISHU_ALERT_LEVEL=always node scripts/cleanup-daily-uploads.js
```

- [ ] 飞书群收到卡片消息
- [ ] 消息标题为 ✅ 日报清理任务 - SUCCESS
- [ ] 消息包含主机名、时间、统计信息
- [ ] 日志中输出 `[alert] feishu notification sent`

---

## 六、Cron 调度验证

### 6.1 检查 PM2 cron 配置

- [ ] `pm2 describe cleanup-daily-uploads` 输出包含 `cron: 0 4 * * *`

### 6.2 调度时间表

| 任务 | 时间 | 说明 |
|------|------|------|
| `backup-db` | 02:00 | 数据库+文件备份（最先执行） |
| `cleanup-sessions` | 03:00 | 过期会话清理 |
| `cleanup-daily-uploads` | 04:00 | 日报临时文件清理 |
| 主服务 | 常驻 | 不受影响 |

> **注意**: cron 时区为服务器本地时区，使用 `timedatectl` 确认时区
> ```bash
> timedatectl
> # 确保 Time zone 为 Asia/Shanghai (CST, +0800)
> ```

---

## 七、监控与运维

### 7.1 日志查看

```bash
# 实时查看清理日志
pm2 logs cleanup-daily-uploads --lines 50

# 查看历史日志文件
tail -100 /opt/doc-mgmt/backend/logs/cleanup-daily-out.log

# 搜索错误
grep "✗\|error\|failed" /opt/doc-mgmt/backend/logs/cleanup-daily-out.log
```

### 7.2 日志轮转（推荐配置）

编辑 `/etc/logrotate.d/doc-mgmt-cleanup`：

```
/opt/doc-mgmt/backend/logs/cleanup-*-*.log {
    daily
    rotate 14
    compress
    delaycompress
    missingok
    notifempty
    copytruncate
}
```

### 7.3 常见问题排查

| 现象 | 可能原因 | 排查命令 |
|------|---------|---------|
| 应用 cron 不触发 | PM2 cron 时区错误 | `pm2 describe cleanup-daily-uploads \| grep cron` |
| 飞书未收到告警 | webhook URL 未配置或网络问题 | `curl -X POST $FEISHU_WEBHOOK_URL -H "Content-Type: application/json" -d '{"msg_type":"text","content":{"text":"test"}}'` |
| 文件未被删除但日志显示扫描到 | 文件名不匹配或扩展名不在白名单 | 检查日志中的 `skip` 信息 |
| 退出码为 2 | 部分文件被占用或权限不足 | 检查 errors 详情，确认文件未被其他进程使用 |
| 主服务内存增长 | 告警失败时 fetch 未释放 | 检查 `cleanup-daily-error.log` |

### 7.4 手动触发清理（应急场景）

```bash
# 立即执行一次清理（保留 3 天）
KEEP_DAYS=3 pm2 start cleanup-daily-uploads

# 或直接执行
cd /opt/doc-mgmt/backend && KEEP_DAYS=3 node scripts/cleanup-daily-uploads.js
```

---

## 八、回滚方案

### 8.1 禁用清理任务

```bash
pm2 stop cleanup-daily-uploads
pm2 delete cleanup-daily-uploads
pm2 save
```

### 8.2 恢复旧配置

```bash
cp ~/dump.pm2.bak.YYYYMMDD ~/.pm2/dump.pm2
pm2 resurrect
```

### 8.3 紧急关闭飞书告警

编辑 `deploy/ecosystem.config.cjs`，将 `FEISHU_ALERT_LEVEL` 改为 `never`：

```bash
pm2 restart cleanup-daily-uploads --update-env
```

---

## 九、验收检查清单

部署完成后逐项确认：

- [ ] `pm2 status` 4 个应用全部存在
- [ ] `doc-mgmt-backend` 状态为 online
- [ ] 手动触发 `pm2 start cleanup-daily-uploads` 成功执行
- [ ] 日志文件 `backend/logs/cleanup-daily-out.log` 有内容
- [ ] 飞书告警（如已配置）测试通过
- [ ] 服务器重启后 PM2 自动恢复
  ```bash
  sudo reboot
  # 重启后验证
  pm2 status
  ```
- [ ] 旧 `crontab.txt` 中的清理任务已删除（避免与 PM2 cron 重复）
  ```bash
  crontab -l | grep -i cleanup
  # 应无输出
  ```
- [ ] 文件目录权限正确
  ```bash
  ls -la /opt/doc-mgmt/backend/files/daily-uploads/
  # 所有者应为运行 PM2 的用户，且有读写权限
  ```

---

## 十、附录

### 10.1 退出码定义

| 退出码 | 含义 | 告警触发 |
|--------|------|---------|
| 0 | 成功 | 仅 always 级别告警 |
| 1 | 致命错误（目录读取失败等） | error/always 级别告警 |
| 2 | 部分文件删除失败 | error/always 级别告警 |

### 10.2 清理规则摘要

- **清理目录**: `backend/files/daily-uploads/`
- **文件名规则**: `daily-{timestamp}-{random4}.ext`
- **扩展名白名单**: `.pdf .doc .docx .xls .xlsx .jpg .jpeg .png .dwg .zip .rar .txt .csv`
- **保留策略**: 按 mtime 计算，超过 KEEP_DAYS 天的文件删除
- **路径安全**: `path.resolve` 校验，禁止穿越 daily-uploads 目录
- **数据库影响**: 无（日报上传文件不入库，删除不影响业务数据）

### 10.3 相关文档

- [CLAUDE.md 第十一章 开发纪律与防回退保障](file:///d:/AICODING0609/工程资料管理系统源码/CLAUDE.md)
- [deploy/crontab.txt](file:///d:/AICODING0609/工程资料管理系统源码/deploy/crontab.txt) — 旧 cron 配置（如已迁移到 PM2，应禁用其中的清理任务）
- [backend/scripts/backup-db.js](file:///d:/AICODING0609/工程资料管理系统源码/backend/scripts/backup-db.js) — 数据库备份脚本
- [backend/scripts/cleanup-sessions.js](file:///d:/AICODING0609/工程资料管理系统源码/backend/scripts/cleanup-sessions.js) — 会话清理脚本

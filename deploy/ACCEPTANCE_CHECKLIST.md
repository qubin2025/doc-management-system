# PM2 定时任务部署验收检查清单

**版本**: v1.0
**日期**: 2026-08-21
**用途**: 部署完成后逐项确认，所有项目通过方可上线
**前置文档**: [DEPLOYMENT_CHECKLIST_CLEANUP.md](./DEPLOYMENT_CHECKLIST_CLEANUP.md) (部署过程清单)

---

## 一、应用运行状态验收

### 1.1 应用列表与状态

```bash
pm2 list
```

| 应用名 | 预期状态 | 验收 |
|--------|---------|------|
| `doc-mgmt-backend` | `online` | ☐ 通过 ☐ 失败 |
| `cleanup-daily-uploads` | `stopped` (等待 cron) | ☐ 通过 ☐ 失败 |
| `cleanup-sessions` | `stopped` (等待 cron) | ☐ 通过 ☐ 失败 |
| `backup-db` | `stopped` (等待 cron) | ☐ 通过 ☐ 失败 |

### 1.2 主服务健康检查

```bash
# 进程详情
pm2 describe doc-mgmt-backend | grep -E "status|uptime|restarts|memory|cpu"

# 端口监听
ss -tlnp | grep :3000
# 或
curl -s http://localhost:3000/api/health
```

| 指标 | 预期值 | 验收 |
|------|--------|------|
| 状态 | `online` | ☐ |
| 重启次数 | 0 (启动后无重启) | ☐ |
| 内存占用 | < 200MB | ☐ |
| CPU 占用 | < 5% (空闲时) | ☐ |
| 端口监听 | 0.0.0.0:3000 | ☐ |
| 健康检查 API | 返回 200 | ☐ |
| uptime | > 60s (稳定运行) | ☐ |

### 1.3 Cron 任务注册

```bash
for app in cleanup-daily-uploads cleanup-sessions backup-db; do
  echo "=== $app ==="
  pm2 describe $app | grep -iE "cron|status"
done
```

| 应用 | 预期 cron 表达式 | 验收 |
|------|-----------------|------|
| `cleanup-daily-uploads` | `0 4 * * *` (每天 04:00) | ☐ |
| `cleanup-sessions` | `0 3 * * *` (每天 03:00) | ☐ |
| `backup-db` | `0 2 * * *` (每天 02:00) | ☐ |

---

## 二、日志文件验收

### 2.1 日志目录与文件

```bash
ls -la /opt/doc-mgmt/backend/logs/
```

| 日志文件 | 预期 | 验收 |
|---------|------|------|
| `backend-out.log` | 存在且有内容 | ☐ |
| `backend-error.log` | 存在（可为空） | ☐ |
| `cleanup-daily-out.log` | 存在（首次触发后） | ☐ |
| `cleanup-daily-error.log` | 存在（可为空） | ☐ |
| `cleanup-sessions-out.log` | 存在（首次触发后） | ☐ |
| `cleanup-sessions-error.log` | 存在（可为空） | ☐ |
| `backup-db-out.log` | 存在（首次触发后） | ☐ |
| `backup-db-error.log` | 存在（可为空） | ☐ |

### 2.2 日志格式校验

```bash
# 校验日志包含结构化字段
tail -20 /opt/doc-mgmt/backend/logs/cleanup-daily-out.log
```

预期每行格式：
```
[ISO时间戳][+耗时][阶段] ✓/✗/! 消息
```

| 字段 | 验收 |
|------|------|
| ISO 时间戳 (如 `2026-08-21T04:00:00.000Z`) | ☐ |
| 累计耗时 (如 `+0.05s`) | ☐ |
| 阶段标签 (init/check/scan/loop/summary/done) | ☐ |
| 状态符号 (✓ 成功 / ! 警告 / ✗ 错误) | ☐ |
| 完整的 init/summary/done 三阶段 | ☐ |

### 2.3 日志轮转配置（可选但推荐）

```bash
# 确认 logrotate 已配置
ls /etc/logrotate.d/ | grep doc-mgmt
cat /etc/logrotate.d/doc-mgmt-cleanup 2>/dev/null || echo "未配置，请按部署清单第七章配置"
```

---

## 三、手动触发验收

### 3.1 cleanup-daily-uploads 预演模式

```bash
cd /opt/doc-mgmt/backend
DRY_RUN=1 KEEP_DAYS=30 node scripts/cleanup-daily-uploads.js
```

| 验收项 | 预期 | 实际 | 验收 |
|--------|------|------|------|
| 退出码 | 0 | | ☐ |
| 日志包含 `[init]` 配置信息 | ✓ | | ☐ |
| 日志包含 `[scan]` 目录扫描结果 | ✓ | | ☐ |
| 日志包含 `[summary]` 统计信息 | ✓ | | ☐ |
| 日志包含 `[done]` 退出码 | ✓ | | ☐ |
| 文件实际未被删除 | ✓ | | ☐ |

### 3.2 backup-db 实际执行

```bash
cd /opt/doc-mgmt/backend
node scripts/backup-db.js
ls -la backups/$(date +%Y-%m-%d)/
```

| 验收项 | 预期 | 实际 | 验收 |
|--------|------|------|------|
| 退出码 | 0 | | ☐ |
| 备份目录创建 | `backups/YYYY-MM-DD/` | | ☐ |
| `planning.db` 已备份 | 文件存在 | | ☐ |
| `files/` 已备份 | 目录存在 | | ☐ |
| 日志包含 DB 备份大小 | ✓ | | ☐ |
| 日志包含清理过期备份记录 | ✓ | | ☐ |

### 3.3 cleanup-sessions 实际执行

```bash
cd /opt/doc-mgmt/backend
node scripts/cleanup-sessions.js
sqlite3 data/planning.db "SELECT COUNT(*) FROM sessions;"
```

| 验收项 | 预期 | 实际 | 验收 |
|--------|------|------|------|
| 退出码 | 0 | | ☐ |
| 过期会话已删除 | 日志显示 deleted N | | ☐ |
| 剩余会话数为合理值 | < 1000 (按业务估算) | | ☐ |

### 3.4 PM2 触发测试

```bash
pm2 start cleanup-daily-uploads
sleep 5
pm2 logs cleanup-daily-uploads --lines 30 --nostream
```

| 验收项 | 预期 | 实际 | 验收 |
|--------|------|------|------|
| PM2 能正确启动应用 | ✓ | | ☐ |
| 执行完毕后状态变 `stopped` | ✓ | | ☐ |
| 日志写入 PM2 日志文件 | ✓ | | ☐ |

---

## 四、飞书告警验收

### 4.1 本地模拟测试

```bash
cd /opt/doc-mgmt/backend
node scripts/test-feishu-alert.mjs
```

| 验收项 | 预期 | 实际 | 验收 |
|--------|------|------|------|
| shouldAlert 函数测试 | 4/4 通过 | | ☐ |
| payload 结构测试 | 28/28 通过 | | ☐ |
| 三种状态 (success/partial_failed/failed) 发送 | 全部成功 | | ☐ |
| 退出码 | 0 | | ☐ |

### 4.2 真实飞书连通性测试（如已配置 webhook）

```bash
# 步骤 1: 编辑 test-feishu-alert.mjs，将 LOCAL_WEBHOOK 改为真实 URL
# LOCAL_WEBHOOK = 'https://open.feishu.cn/open-apis/bot/v2/hook/xxxxxxxx'

# 步骤 2: 注释掉 mock server 启动（或保持启动，URL 指向飞书即可）

# 步骤 3: 运行
node scripts/test-feishu-alert.mjs
```

| 验收项 | 预期 | 实际 | 验收 |
|--------|------|------|------|
| 飞书群收到 3 条卡片消息 | ✓ | | ☐ |
| 成功消息颜色为绿色 | ✓ | | ☐ |
| 失败消息颜色为红色 | ✓ | | ☐ |
| 消息包含主机名、时间、统计 | ✓ | | ☐ |
| 消息包含错误详情（失败场景） | ✓ | | ☐ |

### 4.3 一次性脚本告警验证

```bash
cd /opt/doc-mgmt/backend
FEISHU_ALERT_LEVEL=always node scripts/cleanup-daily-uploads.js
```

| 验收项 | 预期 | 实际 | 验收 |
|--------|------|------|------|
| 日志输出 `[alert] feishu notification sent` | ✓ | | ☐ |
| 飞书群收到卡片消息 | ✓ | | ☐ |
| 卡片标题为 "✅ 日报清理任务 - SUCCESS" | ✓ | | ☐ |

---

## 五、环境与文件系统验收

### 5.1 关键目录权限

```bash
# 检查权限
ls -ld /opt/doc-mgmt/backend/data
ls -ld /opt/doc-mgmt/backend/files
ls -ld /opt/doc-mgmt/backend/files/daily-uploads
ls -ld /opt/doc-mgmt/backend/logs
ls -ld /opt/doc-mgmt/backend/backups
ls -l /opt/doc-mgmt/backend/data/planning.db
```

| 目录/文件 | 预期权限 | 预期所有者 | 验收 |
|----------|---------|-----------|------|
| `data/` | drwxr-xr-x | PM2 用户 | ☐ |
| `data/planning.db` | -rw-r--r-- | PM2 用户 | ☐ |
| `files/` | drwxr-xr-x | PM2 用户 | ☐ |
| `files/daily-uploads/` | drwxr-xr-x | PM2 用户 | ☐ |
| `logs/` | drwxr-xr-x | PM2 用户 | ☐ |
| `backups/` | drwxr-xr-x | PM2 用户 | ☐ |

### 5.2 环境变量生效验证

```bash
pm2 env 0 | grep -E "FILES_PATH|KEEP_DAYS|FEISHU|DB_PATH|BACKUP"  # 0 为主服务 ID
pm2 describe cleanup-daily-uploads | grep -A 20 "envs"
```

| 应用 | 环境变量 | 预期值 | 验收 |
|------|---------|--------|------|
| cleanup-daily-uploads | `FILES_PATH` | `./files` | ☐ |
| cleanup-daily-uploads | `KEEP_DAYS` | `7` | ☐ |
| cleanup-daily-uploads | `FEISHU_ALERT_LEVEL` | `error` | ☐ |
| cleanup-sessions | `DB_PATH` | `./data/planning.db` | ☐ |
| backup-db | `BACKUP_KEEP_DAYS` | `30` | ☐ |

### 5.3 crontab 冲突排查

```bash
# 确认 crontab 中无重复任务（PM2 cron 已接管）
crontab -l | grep -iE "cleanup|backup|session"
# 预期：无输出（或仅 logrotate）

# 检查 /etc/cron.d/
ls /etc/cron.d/ | grep -i doc-mgmt
# 预期：无输出
```

| 验收项 | 预期 | 实际 | 验收 |
|--------|------|------|------|
| crontab 无 cleanup/backup 任务 | ✓ | | ☐ |
| /etc/cron.d/ 无 doc-mgmt 任务 | ✓ | | ☐ |

---

## 六、开机自启验收

### 6.1 PM2 systemd 服务

```bash
systemctl status pm2-$(whoami)
# 或
systemctl is-enabled pm2-$(whoami)
```

| 验收项 | 预期 | 实际 | 验收 |
|--------|------|------|------|
| pm2 systemd 服务存在 | `enabled` | | ☐ |
| 服务状态 | `active` 或 `inactive` (未启动时) | | ☐ |

### 6.2 重启验证（建议在维护窗口执行）

```bash
sudo reboot
# 等待 2 分钟后重新登录

pm2 list
# 预期：4 个应用自动恢复（doc-mgmt-backend online，其他 stopped 等待 cron）
```

| 验收项 | 预期 | 实际 | 验收 |
|--------|------|------|------|
| 重启后 PM2 自动启动 | ✓ | | ☐ |
| doc-mgmt-backend 自动 online | ✓ | | ☐ |
| 其他 3 个应用已注册 | ✓ | | ☐ |

---

## 七、性能与稳定性指标

### 7.1 主服务性能

```bash
# 持续监控 5 分钟
pm2 monit
```

| 指标 | 预期阈值 | 验收 |
|------|---------|------|
| CPU 占用 (5分钟平均) | < 10% | ☐ |
| 内存占用 | < 500MB | ☐ |
| 内存泄漏检测 (1小时观察) | 增长 < 50MB | ☐ |
| Event Loop 延迟 | < 100ms | ☐ |

### 7.2 一次性脚本执行时间

| 脚本 | 预期耗时 | 实测 | 验收 |
|------|---------|------|------|
| cleanup-daily-uploads | < 5s | | ☐ |
| cleanup-sessions | < 2s | | ☐ |
| backup-db | < 30s (视文件数) | | ☐ |

---

## 八、最终验收清单汇总

部署后请逐项勾选，全部通过方可正式上线：

### A. 必须项 (上线门禁)

- [ ] 4 个应用全部在 PM2 注册
- [ ] `doc-mgmt-backend` 状态为 `online`
- [ ] 主服务健康检查 API 返回 200
- [ ] 3 个 cron 表达式正确注册
- [ ] 3 个脚本手动触发均 exit=0
- [ ] 日志文件全部创建且格式正确
- [ ] 关键目录权限正确
- [ ] 环境变量正确加载
- [ ] crontab 无重复任务
- [ ] PM2 开机自启已配置

### B. 推荐项 (运维保障)

- [ ] 飞书告警本地模拟测试 32/32 通过
- [ ] 真实飞书 webhook 连通性测试通过（如已配置）
- [ ] 日志轮转 (logrotate) 已配置
- [ ] 服务器重启验证通过
- [ ] 主服务性能监控达标 (CPU < 10%, 内存 < 500MB)

### C. 文档与运维

- [ ] [DEPLOYMENT_CHECKLIST_CLEANUP.md](./DEPLOYMENT_CHECKLIST_CLEANUP.md) 已归档
- [ ] 飞书 webhook URL 已安全保管（不入库 git）
- [ ] 运维同学已知晓 `pm2 start cleanup-daily-uploads` 手动触发方式
- [ ] 已建立每周巡检 `pm2 list` + 日志检查的习惯

---

## 九、常见问题排查指南

### 9.1 PM2 启动失败

#### 问题 1: `pm2 start ecosystem.config.cjs` 报错 "script not found"

**原因**：`cwd` 路径与实际部署路径不一致。

**排查**：
```bash
# 检查 cwd 设置
cat /opt/doc-mgmt/deploy/ecosystem.config.cjs | grep cwd
# 应为 './backend'

# 检查脚本路径是否存在
ls -la /opt/doc-mgmt/backend/scripts/cleanup-daily-uploads.js
```

**解决**：
```bash
# 方案 1: 修改 cwd 为绝对路径
sed -i "s|cwd: './backend'|cwd: '/opt/doc-mgmt/backend'|" /opt/doc-mgmt/deploy/ecosystem.config.cjs

# 方案 2: 在项目根目录执行
cd /opt/doc-mgmt && pm2 start deploy/ecosystem.config.cjs
```

---

#### 问题 2: `pm2 start` 后应用立即 `errored`

**原因**：Node.js 版本过低、依赖未安装、或代码语法错误。

**排查**：
```bash
# 查看错误日志
pm2 logs doc-mgmt-backend --lines 50 --err

# 常见错误及解决
# 1. "Cannot find module 'better-sqlite3'"
cd /opt/doc-mgmt/backend && npm install --omit=dev

# 2. "SyntaxError: Cannot use import statement outside a module"
# 检查 package.json 是否有 "type": "module"
cat /opt/doc-mgmt/backend/package.json | grep type

# 3. "Error: Cannot find module 'node:fs'"
node --version  # 需要 18+
```

**解决**：
```bash
# 升级 Node.js (使用 nvm)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
source ~/.bashrc
nvm install 18
nvm use 18

# 重装依赖
cd /opt/doc-mgmt/backend
rm -rf node_modules package-lock.json
npm install --omit=dev

# 重新加载 PM2
pm2 delete doc-mgmt-backend
pm2 start /opt/doc-mgmt/deploy/ecosystem.config.cjs
```

---

#### 问题 3: Cron 任务不触发

**原因**：PM2 cron 时区与服务器时区不一致。

**排查**：
```bash
# 检查服务器时区
timedatectl
# 应为: Time zone: Asia/Shanghai (CST, +0800)

# 检查 PM2 cron 注册情况
pm2 describe cleanup-daily-uploads | grep -i cron
# 应输出: cron: 0 4 * * *

# 检查 PM2 日志最近触发时间
pm2 logs cleanup-daily-uploads --lines 10 --nostream
```

**解决**：
```bash
# 方案 1: 设置服务器时区
sudo timedatectl set-timezone Asia/Shanghai

# 方案 2: 在 ecosystem.config.cjs 中设置 TZ 环境变量
env: {
  TZ: 'Asia/Shanghai',
  ...
}

# 方案 3: 手动触发测试
pm2 start cleanup-daily-uploads
```

---

#### 问题 4: 应用启动后内存持续增长

**原因**：可能存在内存泄漏，或主服务未正确释放连接。

**排查**：
```bash
# 持续监控
pm2 monit

# 查看内存详情
pm2 describe doc-mgmt-backend | grep -i memory

# 生成堆快照（需要在代码中集成 heapdump）
kill -USR2 <pid>
```

**解决**：
```bash
# 方案 1: 配置自动重启阈值
# 编辑 ecosystem.config.cjs
# max_memory_restart: '500M',  # 已配置

# 方案 2: 临时重启
pm2 restart doc-mgmt-backend

# 方案 3: 长期方案 - 排查代码内存泄漏
# 使用 clinic.js 分析
npm install -g clinic
clinic doctor -- node backend/server.js
```

---

### 9.2 权限问题

#### 问题 1: 文件写入失败 `EACCES`

**原因**：PM2 用户与文件所有者不一致。

**排查**：
```bash
# 查看 PM2 运行用户
pm2 describe doc-mgmt-backend | grep -i "user\|exec"

# 查看文件所有者
ls -la /opt/doc-mgmt/backend/data/
ls -la /opt/doc-mgmt/backend/files/
ls -la /opt/doc-mgmt/backend/logs/
```

**解决**：
```bash
# 方案 1: 修改文件所有者（推荐）
sudo chown -R $(whoami):$(whoami) /opt/doc-mgmt/backend/data
sudo chown -R $(whoami):$(whoami) /opt/doc-mgmt/backend/files
sudo chown -R $(whoami):$(whoami) /opt/doc-mgmt/backend/logs
sudo chown -R $(whoami):$(whoami) /opt/doc-mgmt/backend/backups

# 方案 2: 修改权限（不推荐，安全性低）
sudo chmod -R 755 /opt/doc-mgmt/backend/data
sudo chmod -R 755 /opt/doc-mgmt/backend/files
```

---

#### 问题 2: SQLite 数据库锁定 `SQLITE_BUSY`

**原因**：多个进程同时写入数据库。

**排查**：
```bash
# 查看数据库连接
fuser /opt/doc-mgmt/backend/data/planning.db
# 或
lsof /opt/doc-mgmt/backend/data/planning.db
```

**解决**：
```bash
# 方案 1: 重启所有访问数据库的应用
pm2 restart doc-mgmt-backend
pm2 restart cleanup-sessions  # 如果正在运行

# 方案 2: 检查代码是否启用 WAL 模式
sqlite3 /opt/doc-mgmt/backend/data/planning.db "PRAGMA journal_mode;"
# 应为: wal

# 如果不是 wal，启用它（需停服）：
pm2 stop doc-mgmt-backend
sqlite3 /opt/doc-mgmt/backend/data/planning.db "PRAGMA journal_mode=WAL;"
pm2 start doc-mgmt-backend
```

---

#### 问题 3: PM2 开机自启失败 `systemctl status pm2-xxx` 报错

**原因**：PM2 startup 命令未执行或执行失败。

**排查**：
```bash
# 查看 PM2 systemd 服务
systemctl status pm2-$(whoami)

# 查看启动日志
journalctl -u pm2-$(whoami) -n 50
```

**解决**：
```bash
# 重新配置开机自启
pm2 unstartup  # 先卸载旧的
pm2 startup    # 按提示执行返回的 sudo 命令
pm2 save       # 保存当前进程列表

# 验证
systemctl is-enabled pm2-$(whoami)
# 应为: enabled
```

---

### 9.3 飞书告警问题

#### 问题 1: 飞书未收到告警消息

**排查流程**：
```bash
# 步骤 1: 确认 webhook URL 已配置
pm2 describe cleanup-daily-uploads | grep FEISHU_WEBHOOK_URL
# 应为非空 URL

# 步骤 2: 手动触发告警测试
cd /opt/doc-mgmt/backend
FEISHU_ALERT_LEVEL=always node scripts/cleanup-daily-uploads.js 2>&1 | grep alert

# 步骤 3: 检查网络连通性
curl -X POST $FEISHU_WEBHOOK_URL \
  -H "Content-Type: application/json" \
  -d '{"msg_type":"text","content":{"text":"test"}}'

# 步骤 4: 检查飞书机器人安全设置
# 飞书群 → 群设置 → 群机器人 → 编辑机器人 → 安全设置
# 如果启用了"自定义关键词"，关键词必须出现在消息内容中
```

**解决**：
```bash
# 方案 1: 配置 webhook URL
# 编辑 ecosystem.config.cjs
FEISHU_WEBHOOK_URL: 'https://open.feishu.cn/open-apis/bot/v2/hook/xxxxxxxx',
pm2 restart cleanup-daily-uploads --update-env

# 方案 2: 调整飞书机器人安全设置
# 关闭安全设置，或添加关键词 "日报清理任务" / "数据库备份任务" / "会话清理任务"

# 方案 3: 检查防火墙
sudo ufw status
# 确保出站 HTTPS (443) 端口未被封禁
```

---

#### 问题 2: 飞书返回 `code: 19021` 或 `19024`

**原因**：飞书机器人安全设置（关键词/IP 白名单/签名校验）未通过。

| 错误码 | 含义 | 解决方案 |
|--------|------|---------|
| 19021 | 关键词不匹配 | 添加关键词 "日报清理任务" 到机器人安全设置 |
| 19022 | IP 不在白名单 | 添加服务器出口 IP 到白名单 |
| 19023 | 时间戳过期 | 检查服务器时间是否准确 |
| 19024 | 签名校验失败 | 重新配置机器人，更新签名密钥 |

**排查**：
```bash
# 查看服务器出口 IP
curl -s https://ifconfig.me

# 查看服务器时间
date
# 应为准确的北京时间
```

---

#### 问题 3: 飞书告警发送慢（>5秒）

**原因**：网络延迟或飞书 API 限流。

**排查**：
```bash
# 测试飞书 API 延迟
time curl -X POST $FEISHU_WEBHOOK_URL \
  -H "Content-Type: application/json" \
  -d '{"msg_type":"text","content":{"text":"test"}}'
```

**解决**：
```bash
# 告警发送是异步的，不影响主流程（已设置 10s 超时）
# 如果飞书 API 持续慢，可考虑:
# 1. 降低告警级别为 error（仅失败告警）
# 2. 启用多个 webhook 负载均衡
```

---

### 9.4 备份/清理失败

#### 问题 1: backup-db 失败 `EACCES: permission denied, mkdir`

**原因**：备份目录权限不足。

**解决**：
```bash
sudo mkdir -p /opt/doc-mgmt/backend/backups
sudo chown -R $(whoami):$(whoami) /opt/doc-mgmt/backend/backups
sudo chmod 755 /opt/doc-mgmt/backend/backups
```

#### 问题 2: cleanup-daily-uploads 跳过所有文件

**排查**：
```bash
# 查看日志中的 skip 信息
grep "skip" /opt/doc-mgmt/backend/logs/cleanup-daily-out.log

# 三种跳过原因:
# 1. non-matching name: 文件名不匹配 daily-{ts}-{rand}.ext
# 2. ext: 扩展名不在白名单
# 3. fresh: 文件在保留期内（KEEP_DAYS 天内）
```

#### 问题 3: cleanup-sessions 删除失败

**排查**：
```bash
# 检查数据库锁
sqlite3 /opt/doc-mgmt/backend/data/planning.db "PRAGMA journal_mode;"
# 应为 wal

# 检查表是否存在
sqlite3 /opt/doc-mgmt/backend/data/planning.db ".schema sessions"
```

---

## 十、应急处理流程

### 10.1 紧急停止所有定时任务

```bash
pm2 stop cleanup-daily-uploads cleanup-sessions backup-db
pm2 save
```

### 10.2 紧急关闭飞书告警

```bash
# 编辑 ecosystem.config.cjs，将所有应用的 FEISHU_ALERT_LEVEL 改为 'never'
sed -i "s/FEISHU_ALERT_LEVEL: 'error'/FEISHU_ALERT_LEVEL: 'never'/g" /opt/doc-mgmt/deploy/ecosystem.config.cjs

# 重启应用以应用新配置
pm2 restart cleanup-daily-uploads cleanup-sessions backup-db --update-env
```

### 10.3 回滚到部署前状态

```bash
# 查看备份目录
ls -la /opt/doc-mgmt/deploy/backup-*/

# 恢复 PM2 dump
cp /opt/doc-mgmt/deploy/backup-YYYYMMDD-HHMMSS/dump.pm2.bak ~/.pm2/dump.pm2
pm2 resurrect

# 恢复 ecosystem 配置
cp /opt/doc-mgmt/deploy/backup-YYYYMMDD-HHMMSS/ecosystem.config.cjs.bak /opt/doc-mgmt/deploy/ecosystem.config.cjs
pm2 delete all
pm2 start /opt/doc-mgmt/deploy/ecosystem.config.cjs
pm2 save
```

---

## 附录：验收签字

| 角色 | 姓名 | 日期 | 签字 |
|------|------|------|------|
| 部署人员 | | | |
| 运维负责人 | | | |
| 开发负责人 | | | |

**部署日期**: ___________
**服务器**: ___________
**PM2 版本**: ___________
**Node.js 版本**: ___________

#!/bin/bash
# 端到端测试 — 模拟完整项目流程
# 使用前: 启动后端 node backend/server.js & 前端 npx vite --host &

API="http://localhost:3000/api"
PASS=0
FAIL=0

check() {
  local desc="$1"
  local method="$2"
  local url="$3"
  local data="$4"
  local expected="$5"

  if [ -n "$data" ]; then
    resp=$(curl -s -X "$method" "$url" -H "Content-Type: application/json" -H "Authorization: Bearer $TOKEN" -d "$data" 2>/dev/null)
  else
    resp=$(curl -s -X "$method" "$url" -H "Authorization: Bearer $TOKEN" 2>/dev/null)
  fi

  if echo "$resp" | grep -q "$expected"; then
    echo "  ✓ $desc"
    PASS=$((PASS+1))
  else
    echo "  ✗ $desc — $resp"
    FAIL=$((FAIL+1))
  fi
}

# 1. 登录
echo "=== 登录 ==="
TOKEN=$(curl -s -X POST "$API/auth/login" -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}' | grep -o '"token":"[^"]*"' | cut -d'"' -f4)
if [ -z "$TOKEN" ]; then echo "✗ 登录失败"; exit 1; fi
echo "  ✓ Token: ${TOKEN:0:20}..."

# 2. 项目CRUD
echo "=== 项目管理 ==="
check "创建项目" POST "$API/projects" '{"name":"e2e-test-'"$(date +%s)"'"}'
check "列出项目" GET "$API/projects" "" "e2e-test"
PROJ_NAME=$(curl -s GET "$API/projects" -H "Authorization: Bearer $TOKEN" | grep -o '"name":"e2e-test[^"]*"' | head -1 | cut -d'"' -f4)
echo "  → 项目名: $PROJ_NAME"

# 3. 目标管理
echo "=== 目标管理 ==="
check "创建目标" POST "$API/objectives" '{"projectName":"'"$PROJ_NAME"'","title":"项目按时交付","level":"root","weight":1}'
check "获取目标树" GET "$API/objectives?project=$PROJ_NAME" "" "tree"

# 4. 基线管理
echo "=== 基线管理 ==="
check "创建基线" POST "$API/baselines" '{"projectName":"'"$PROJ_NAME"'","baselineType":"scope","snapshot":{"cpi":1.0,"spi":1.0},"description":"E2E测试基线"}'
check "获取基线" GET "$API/baselines?project=$PROJ_NAME" "" "E2E"

# 5. 导出
echo "=== 数据导出 ==="
check "导出项目" GET "$API/export/project/$PROJ_NAME" "" "version"

# 6. MCP
echo "=== MCP协议 ==="
check "MCP工具列表" GET "$API/mcp/tools/list" "" "ai_chat"
check "MCP健康" GET "$API/mcp/health" "" "ok"

# 7. 健康检查
echo "=== 系统健康 ==="
check "健康检查" GET "$API" "" "ok"
check "系统统计" GET "$API/stats" "" "projects"

# 清理
echo "=== 清理 ==="
PROJ_ID=$(curl -s GET "$API/projects" -H "Authorization: Bearer $TOKEN" | grep -o "\"name\":\"$PROJ_NAME\"" | head -1)
curl -s -X DELETE "$API/projects/$(curl -s GET "$API/projects" -H "Authorization: Bearer $TOKEN" | grep -o "\"id\":[0-9]*" | tail -1 | cut -d: -f2)" -H "Authorization: Bearer $TOKEN" > /dev/null 2>&1
echo "  ✓ 清理完成"

echo ""
echo "=== 结果: $PASS 通过 / $FAIL 失败 ==="

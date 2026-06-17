#!/bin/bash
# ============================================================
# 全过程工程咨询管理系统 — 生产部署启动脚本
# 用法: bash deploy/start.sh [--with-python] [--with-neo4j]
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJ_DIR="$(dirname "$SCRIPT_DIR")"
cd "$PROJ_DIR"

echo "========================================"
echo "  全过程工程咨询管理系统 v2.5.0"
echo "  启动中..."
echo "========================================"

# 1. 检查 .env 配置
if [ ! -f backend/.env ]; then
  echo "❌ 缺少 backend/.env，请从 backend/.env.example 复制并填写:"
  echo "   cp backend/.env.example backend/.env"
  echo "   vim backend/.env"
  echo ""
  echo "   必填:  DEEPSEEK_API_KEY"
  echo "   推荐:  DASHSCOPE_API_KEY (通义Embedding)"
  echo "   可选:  NEO4J_URI, ZHIPU_API_KEY, QWEN_API_KEY"
  exit 1
fi

# 加载环境变量
set -a; source backend/.env; set +a

# 检查必填项
if [ -z "$DEEPSEEK_API_KEY" ] || [ "$DEEPSEEK_API_KEY" = "sk-your-deepseek-api-key" ]; then
  echo "⚠️  DEEPSEEK_API_KEY 未配置，AI功能将不可用"
  echo "   请在 backend/.env 中设置有效的 API Key"
fi

# 2. 安装依赖（首次运行）
if [ ! -d node_modules ]; then
  echo "📦 安装前端依赖..."
  npm install --production
fi
if [ ! -d backend/node_modules ]; then
  echo "📦 安装后端依赖..."
  cd backend && npm install --production && cd ..
fi

# 3. 启动后端
echo "🚀 启动后端 (port ${PORT:-3000})..."
cd backend
NODE_ENV=production node server.js &
BACKEND_PID=$!
cd ..

# 4. 可选: 启动Python LightRAG服务
if [[ "$*" == *--with-python* ]]; then
  if [ -f services/lightrag-server/main.py ]; then
    echo "🐍 启动LightRAG Python服务 (port 8000)..."
    cd services/lightrag-server
    if [ ! -d venv ]; then
      python3 -m venv venv
      source venv/bin/activate
      pip install -q -r requirements.txt
    else
      source venv/bin/activate
    fi
    DEEPSEEK_API_KEY="$DEEPSEEK_API_KEY" \
    DASHSCOPE_API_KEY="$DASHSCOPE_API_KEY" \
    python3 main.py &
    PYTHON_PID=$!
    deactivate 2>/dev/null || true
    cd ../..
  fi
fi

# 5. 可选: 启动Neo4j (需先安装)
if [[ "$*" == *--with-neo4j* ]]; then
  if command -v neo4j &>/dev/null; then
    echo "🗄️  启动Neo4j..."
    neo4j start
  else
    echo "⚠️  Neo4j未安装，知识图谱使用离线模式"
  fi
fi

# 6. 等待后端就绪
sleep 3
if curl -s http://localhost:${PORT:-3000}/api >/dev/null 2>&1; then
  echo "✅ 后端已就绪: http://localhost:${PORT:-3000}/api"
else
  echo "⚠️  后端可能尚未就绪，请稍候..."
fi

echo ""
echo "========================================"
echo "  启动完成！"
echo "========================================"
echo "  前端生产构建: npm run build && serve -s dist"
echo "  或开发模式:   npm run dev"
echo ""
echo "  服务状态:"
echo "    后端 API:   http://localhost:${PORT:-3000}/api"
echo "    LightRAG:   http://localhost:8000/docs"
echo "    Neo4j:      http://localhost:7474"
echo ""
echo "  停止服务: kill $BACKEND_PID ${PYTHON_PID:-}"
echo "========================================"

# 保持前台运行
wait $BACKEND_PID

@echo off
chcp 65001 >nul
echo ========================================
echo  全过程工程咨询管理系统 — 一键启动
echo ========================================
echo.

:: 0. Docker (优先启动，后续服务依赖)
echo [0/5] 启动 Docker Desktop...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo   正在启动 Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo   等待 Docker 就绪...
    :wait_docker
    timeout /t 3 /nobreak >nul
    docker info >nul 2>&1
    if %errorlevel% neq 0 goto wait_docker
    echo   ✓ Docker 已就绪
) else (
    echo   ✓ Docker 已运行
)

echo   启动 Neo4j + RAGFlow...
docker compose -p docmgmt up -d neo4j ragflow 2>nul
docker start doc-mgmt-neo4j ragflow-server 2>nul
echo   ✓ 容器已启动

:: 1. 后端服务
echo.
echo [1/5] 启动后端 API 服务...
start "Backend" cmd /c "cd backend && node server.js"
timeout /t 3 /nobreak >nul

:: 2. 前端服务
echo [2/5] 启动前端开发服务器...
start "Frontend" cmd /c "npx vite --host"
timeout /t 3 /nobreak >nul

:: 3. Ollama 本地AI
echo [3/5] 检查 Ollama 本地AI...
ollama --version >nul 2>&1
if %errorlevel%==0 (
    echo   ✓ Ollama 已安装
) else (
    echo   - Ollama 未安装，跳过本地AI
)

:: 4. Python 可选服务
echo [4/5] 检查 Python 服务...
python --version >nul 2>&1
if %errorlevel%==0 (
    echo   启动 LightRAG + PaddleOCR...
    start "LightRAG" cmd /c "cd services\lightrag-server && python main.py"
    start "OCR" cmd /c "cd services\paddleocr-server && python main.py"
) else (
    echo   - Python 未安装，跳过
)

:: 5. 健康检查
echo.
echo [5/5] 等待服务就绪...
timeout /t 5 /nobreak >nul

echo.
echo ╔══════════════════════════════════════════╗
echo ║          启动完成！                       ║
echo ╠══════════════════════════════════════════╣
echo ║  🖥  桌面端  http://localhost:5300       ║
echo ║  📱 手机端  http://localhost:5300        ║
echo ║            /mobile.html                  ║
echo ║  🔧 API     http://localhost:3000/api    ║
echo ║  📊 Neo4j   http://localhost:7474       ║
echo ║  📚 RAGFlow http://localhost:9380       ║
echo ║  🤖 Ollama  http://localhost:11434      ║
echo ╠══════════════════════════════════════════╣
echo ║  登录: admin / admin123                  ║
echo ╚══════════════════════════════════════════╝
echo.
echo 按任意键打开前端...
pause >nul
start http://localhost:5300

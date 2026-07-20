@echo off
echo ========================================
echo  全过程工程咨询管理系统 — 一键启动
echo ========================================
echo.

:: 1. 后端服务
echo [1/4] 启动后端API服务...
start "Backend" cmd /c "cd backend && node server.js"
timeout /t 3 /nobreak >nul

:: 2. 前端服务
echo [2/4] 启动前端开发服务器...
start "Frontend" cmd /c "npx vite --host"
timeout /t 3 /nobreak >nul

:: 3. Python可选服务
echo [3/4] 检查Python服务...
python --version >nul 2>&1
if %errorlevel%==0 (
    echo   Python已安装，启动OCR和LightRAG...
    start "OCR" cmd /c "cd services\paddleocr-server && python main.py"
    start "LightRAG" cmd /c "cd services\lightrag-server && python main.py"
) else (
    echo   Python未安装，跳过OCR/LightRAG
)

:: 4. Docker可选服务
echo [4/4] 检查Docker服务...
docker info >nul 2>&1
if %errorlevel%==0 (
    echo   Docker已安装，启动Neo4j和RAGFlow...
    docker compose up -d neo4j ragflow 2>nul
) else (
    echo   Docker未安装，跳过Neo4j/RAGFlow
)

echo.
echo ========================================
echo  启动完成！
echo  前端: http://localhost:5300
echo  后端: http://localhost:3000
echo  登录: admin / admin123
echo ========================================
pause

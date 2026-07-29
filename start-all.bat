@echo off
chcp 65001 >nul 2>&1
cls
echo.
echo ===============================================
echo    Quan Guo Cheng Gong Cheng Zi Xun Guan Li
echo   全过程工程咨询管理系统 - 一键启动
echo ===============================================
echo.

:: 0. Docker
echo [0/5] Docker Desktop...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo   Starting Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo   Waiting for Docker...
    :wait_docker
    timeout /t 3 /nobreak >nul
    docker info >nul 2>&1
    if %errorlevel% neq 0 goto wait_docker
    echo   Docker ready
) else (
    echo   Docker already running
)
echo   Starting Neo4j + RAGFlow...
docker compose -p docmgmt up -d neo4j ragflow 2>nul
docker start doc-mgmt-neo4j ragflow-server 2>nul

:: 1. Backend
echo.
echo [1/5] Backend API :3000...
start "Backend" cmd /c "cd backend && node server.js"
timeout /t 3 /nobreak >nul

:: 2. Frontend
echo [2/5] Frontend Dev :5300...
start "Frontend" cmd /c "npx vite --host"
timeout /t 3 /nobreak >nul

:: 3. Ollama (check only, do not start)
echo [3/5] Ollama local AI...
ollama --version >nul 2>&1
if %errorlevel%==0 (
    echo   Ollama installed (run 'ollama serve' manually)
) else (
    echo   Ollama not installed - skipped
)

:: 4. Python services
echo [4/5] Python services...
python --version >nul 2>&1
if %errorlevel%==0 (
    echo   Starting LightRAG + PaddleOCR...
    start "LightRAG" cmd /c "cd services\lightrag-server && python main.py"
    start "OCR" cmd /c "cd services\paddleocr-server && python main.py"
) else (
    echo   Python not installed - skipped
)

:: 5. Done
echo.
echo [5/5] Waiting for services...
timeout /t 5 /nobreak >nul

echo.
echo ===============================================
echo   ALL SERVICES STARTED
echo ===============================================
echo.
echo   Desktop   : http://localhost:5300
echo   Mobile    : http://localhost:5300/mobile.html
echo   API       : http://localhost:3000/api
echo   Neo4j     : http://localhost:7474
echo   RAGFlow   : http://localhost:9380
echo.
echo   Login     : admin / admin123
echo.
echo ===============================================
echo.
echo Press any key to open browser...
pause >nul
start http://localhost:5300

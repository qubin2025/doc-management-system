@echo off
cd /d %~dp0
chcp 65001 >nul 2>&1
cls
echo.
echo ===============================================
echo   全过程工程咨询管理系统 v5.1 — 一键启动
echo ===============================================
echo.

:: 0. Docker (Neo4j + RAGFlow)
echo [0/6] Docker Engine...
docker info >nul 2>&1
if %errorlevel% neq 0 (
    echo   Starting Docker Desktop...
    start "" "C:\Program Files\Docker\Docker\Docker Desktop.exe"
    echo   Waiting for Docker Engine...
    :wait_docker
    timeout /t 3 /nobreak >nul
    docker info >nul 2>&1
    if %errorlevel% neq 0 goto wait_docker
    echo   Docker Engine ready
) else (
    echo   Docker Engine already running
)
echo   Starting Neo4j + RAGFlow containers...
docker compose -p docmgmt up -d neo4j ragflow 2>nul
docker start doc-mgmt-neo4j ragflow-server 2>nul
echo   Waiting for Neo4j healthy...
:wait_neo4j
timeout /t 3 /nobreak >nul
curl -s -o /dev/null http://localhost:7474 2>nul
if %errorlevel% neq 0 goto wait_neo4j
echo   Neo4j ready

:: 1. Backend
echo.
echo [1/6] Backend API :3000...
start "Backend" cmd /c "cd backend && node server.js"
timeout /t 3 /nobreak >nul

:: 2. Frontend
echo [2/6] Frontend Dev :5300...
start "Frontend" cmd /c "npx vite --host"
timeout /t 3 /nobreak >nul

:: 3. LightRAG
echo [3/6] LightRAG Knowledge :8000...
python --version >nul 2>&1
if %errorlevel%==0 (
    start "LightRAG" cmd /c "cd services\lightrag-server && python main.py"
    echo   LightRAG starting...
) else (
    echo   Python not found - skipped
)

:: 4. PaddleOCR
echo [4/6] PaddleOCR Document Parser :8001...
python --version >nul 2>&1
if %errorlevel%==0 (
    start "PaddleOCR" cmd /c "cd services\paddleocr-server && python main.py"
    echo   PaddleOCR starting...
) else (
    echo   Python not found - skipped
)

:: 5. Ollama (check only, never auto-start)
echo [5/6] Ollama local AI...
ollama --version >nul 2>&1
if %errorlevel%==0 (
    echo   Ollama installed — NOT auto-started (run 'ollama serve' manually if needed)
) else (
    echo   Ollama not installed — skipped
)

:: 6. Done
echo.
echo [6/6] Waiting for all services...
timeout /t 5 /nobreak >nul

echo.
echo ===============================================
echo   ALL SERVICES STARTED
echo ===============================================
echo.
echo   [Online]                        [Offline]
echo   Backend   :3000                 Ollama  :11434
echo   Frontend  :5300
echo   Neo4j     :7474
echo   RAGFlow   :9380
echo   LightRAG  :8000
echo   PaddleOCR :8001
echo.
echo   Desktop   : http://localhost:5300
echo   Mobile    : http://localhost:5300/mobile.html
echo   API       : http://localhost:3000/api
echo   Health    : http://localhost:3000/api/health
echo.
echo   Login     : admin / admin123
echo.
echo ===============================================
echo.
echo Press any key to open browser...
pause >nul
start http://localhost:5300

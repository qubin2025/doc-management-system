@echo off
chcp 65001 >nul
title 全过程工程咨询管理系统 v2.5.0

echo ========================================
echo   全过程工程咨询管理系统 v2.5.0
echo   启动中...
echo ========================================

REM 1. 后端
echo [1/5] 启动后端 (port 3000)...
start "API Server" cmd /c "cd /d %~dp0backend && node server.js"

REM 等待后端就绪
timeout /t 3 /nobreak >nul

REM 2. 前端
echo [2/5] 启动前端 (port 5173)...
start "Vite Frontend" cmd /c "cd /d %~dp0 && npm run dev"

REM 3. Python EasyOCR
echo [3/5] 启动文档解析 (port 8001)...
start "EasyOCR Parser" cmd /c "cd /d %~dp0services\paddleocr-server && python main.py"

REM 4. Python LightRAG
echo [4/5] 启动LightRAG (port 8000)...
start "LightRAG Engine" cmd /c "cd /d %~dp0services\lightrag-server && python main.py"

REM 5. Docker services
echo [5/5] 启动Docker服务 (RAGFlow+Neo4j)...
docker compose -f "%~dp0services\ragflow\docker-compose.yml" up -d 2>nul

echo.
echo ========================================
echo   启动完成！
echo   前端: http://localhost:5173
echo   后端: http://localhost:3000/api
echo   EasyOCR: http://localhost:8001
echo   LightRAG: http://localhost:8000
echo   RAGFlow: http://localhost:9380
echo   Casdoor: http://localhost:8002
echo ========================================
echo.
pause

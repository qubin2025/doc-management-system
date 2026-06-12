@echo off
chcp 65001 >nul
title 全过程工程咨询管理系统

echo ========================================
echo  全过程工程咨询管理系统 — 一键启动
echo ========================================
echo.

cd /d "%~dp0.."

:: 1. 检查 Node.js
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] 未找到 Node.js，请先安装 Node.js 18+
    echo 下载: https://nodejs.org/
    pause
    exit /b 1
)
echo [1/4] Node.js 已安装 ✓

:: 2. 检查后端依赖
if not exist "backend\node_modules\" (
    echo [2/4] 安装后端依赖...
    cd backend
    call npm install
    cd ..
) else (
    echo [2/4] 后端依赖已安装 ✓
)

:: 3. 检查前端依赖
if not exist "node_modules\" (
    echo [3/4] 安装前端依赖...
    call npm install
) else (
    echo [3/4] 前端依赖已安装 ✓
)

:: 4. 检查 .env
if not exist "backend\.env" (
    echo [!] backend\.env 不存在，从模板创建...
    copy backend\.env.example backend\.env >nul
    echo     请编辑 backend\.env 填入 API Keys 后重新运行
    notepad backend\.env
    pause
    exit /b 1
)
echo [4/4] 配置检查通过 ✓
echo.

:: 启动后端
echo 正在启动后端服务 (端口 3000)...
start "全过程-后端" cmd /c "cd /d %cd%\backend && node server.js"

:: 等待后端启动
timeout /t 3 /nobreak >nul

:: 启动前端 (使用 serve 提供静态文件)
echo 正在启动前端服务 (端口 8080)...
start "全过程-前端" cmd /c "cd /d %cd% && npx serve dist -l 8080 --no-clipboard"

timeout /t 2 /nobreak >nul

:: 打开浏览器
echo 正在打开浏览器...
start http://localhost:8080

echo.
echo ========================================
echo  部署完成！
echo  前端: http://localhost:8080
echo  后端: http://localhost:3000/api
echo  默认账号: admin / 首次启动后请查看部署说明
echo ========================================
echo.
echo 按任意键关闭此窗口...
pause >nul

@echo off
chcp 65001 >nul
title 打包部署文件

echo ========================================
echo  全过程工程咨询管理系统 — 部署打包
echo ========================================
echo.

set "SRC=%~dp0.."
set "OUT=%~dp0..\..\全过程咨询平台_部署包"

:: 清理旧包
if exist "%OUT%" rd /s /q "%OUT%"
mkdir "%OUT%"

echo [1/5] 复制源代码...
xcopy "%SRC%\src" "%OUT%\src\" /E /I /Q >nul
xcopy "%SRC%\backend" "%OUT%\backend\" /E /I /Q >nul
xcopy "%SRC%\deploy" "%OUT%\deploy\" /E /I /Q >nul
xcopy "%SRC%\public" "%OUT%\public\" /E /I /Q >nul

echo [2/5] 复制配置文件...
copy "%SRC%\package.json" "%OUT%\" >nul
copy "%SRC%\package-lock.json" "%OUT%\" >nul
copy "%SRC%\vite.config.ts" "%OUT%\" >nul
copy "%SRC%\tsconfig.json" "%OUT%\" >nul
copy "%SRC%\tsconfig.node.json" "%OUT%\" >nul 2>nul
copy "%SRC%\index.html" "%OUT%\" >nul
copy "%SRC%\.env.example" "%OUT%\env.example" >nul
copy "%SRC%\.env.production" "%OUT%\env.production" >nul
copy "%SRC%\Dockerfile" "%OUT%\" >nul
copy "%SRC%\docker-compose.yml" "%OUT%\" >nul
copy "%SRC%\.dockerignore" "%OUT%\" >nul
copy "%SRC%\部署说明.md" "%OUT%\" >nul
copy "%SRC%\DEVELOPMENT_LOG.md" "%OUT%\" >nul 2>nul

echo [3/5] 清理冗余文件...
rd /s /q "%OUT%\src\components\*.bak" 2>nul
rd /s /q "%OUT%\src\components\*.bak2" 2>nul
rd /s /q "%OUT%\src\components\*.bak3" 2>nul
rd /s /q "%OUT%\src\components\*.clean" 2>nul
rd /s /q "%OUT%\src\components\*.fix" 2>nul
rd /s /q "%OUT%\backend\node_modules" 2>nul
rd /s /q "%OUT%\node_modules" 2>nul

echo [4/5] 生成 .env 模板...
echo VITE_API_URL=http://localhost:3000/api > "%OUT%\.env"
echo VITE_LOCAL_AI_PORT=11434 >> "%OUT%\.env"

echo [5/5] 打包完成！
echo.
echo 部署包位置: %OUT%
echo 大小:
dir "%OUT%" /s | find "File(s)"

echo.
echo 部署步骤:
echo   1. 复制 "%OUT%" 到目标电脑
echo   2. 阅读 部署说明.md
echo   3. 配置 backend\.env 中的 API Keys
echo   4. Windows: 双击 deploy\start.bat
echo      Linux:   bash deploy\deploy.sh
echo.
pause

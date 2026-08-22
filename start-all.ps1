<#
.SYNOPSIS
  全过程工程咨询管理平台 — 统一启动编排脚本 v5.2
  用途: 一键启动 Docker/后端/前端/LightRAG/PaddleOCR 全部环境并打印详细启动日志
  用法:  PowerShell -ExecutionPolicy Bypass -File .\start-all.ps1
  或:    ./start-all.ps1
  日志:  .\logs\start-all-YYYYMMDD-HHMMSS.log  +  各服务独立日志 .\logs\<服务>.log
#>

$ErrorActionPreference = 'Continue'
$ProjectRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
$LogDir      = Join-Path $ProjectRoot "logs"
$RunStamp    = Get-Date -Format "yyyyMMdd-HHmmss"
if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Path $LogDir -Force | Out-Null }

$GlobalLogFile = Join-Path $LogDir "start-all-$RunStamp.log"
$BackendLog    = Join-Path $LogDir "backend.log"
$FrontendLog   = Join-Path $LogDir "frontend.log"
$LightragLog   = Join-Path $LogDir "lightrag.log"
$PaddleocrLog  = Join-Path $LogDir "paddleocr.log"

function global:Write-Orch {
  param(
    [string]$Level = "INFO",
    [string]$Msg,
    [string]$Detail = ""
  )
  $ts  = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  $tag = "[ORCH-$Level.ToUpper()]"
  $line = if ($Detail) { "$ts [ORCH] $($Level.ToUpper().PadRight(5)) $Msg | $Detail" } else { "$ts [ORCH] $($Level.ToUpper().PadRight(5)) $Msg" }
  Write-Host $line
  Add-Content -Path $GlobalLogFile -Value $line -ErrorAction SilentlyContinue
}
function global:Write-OrchPhase($n) { Write-Host ""; Write-Orch "PHASE" "===== $n =====" }
function global:Write-OrchOK   ($m,$d="") { Write-Orch "OK"    $m $d }
function global:Write-OrchWARN ($m,$d="") { Write-Orch "WARN"  $m $d }
function global:Write-OrchERR  ($m,$d="") { Write-Orch "ERROR" $m $d }
function global:Write-OrchFATAL($m,$d="") { Write-Orch "FATAL" $m $d }
function global:Wait-Port {
  param([int]$Port,[int]$TimeoutSec=30,[string]$Name="service")
  $start = Get-Date
  Write-Orch "INFO" "等待端口 $Port ($Name) 监听..." "timeout=${TimeoutSec}s"
  while (((Get-Date) - $start).TotalSeconds -lt $TimeoutSec) {
    if (Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue) {
      Write-OrchOK "端口 $Port ($Name) 已监听" "耗时 $([math]::Round(((Get-Date)-$start).TotalSeconds,1))s"
      return $true
    }
    Start-Sleep -Milliseconds 800
  }
  Write-OrchWARN "端口 $Port ($Name) 在 $TimeoutSec 秒内未就绪" "可能需要更长时间或启动失败 → 检查日志 $(Join-Path $LogDir \"$Name.log\")"
  return $false
}
function global:Test-HTTP {
  param([string]$Url,[int]$TimeoutSec=5,[string]$Name="")
  try {
    $r = Invoke-WebRequest -Uri $Url -TimeoutSec $TimeoutSec -UseBasicParsing -ErrorAction Stop
    Write-OrchOK "HTTP health [$Name]" "status=$($r.StatusCode)  url=$Url"
    return $true
  } catch {
    $code = $_.Exception.Response.StatusCode.value__
    $msg  = $_.Exception.Message.Split([Environment]::NewLine)[0]
    if ($code) { Write-OrchWARN "HTTP health [$Name]" "status=$code  url=$Url" }
    else       { Write-OrchWARN "HTTP health [$Name]" "$msg  url=$Url" }
    return $false
  }
}
function global:Start-Detached {
  param(
    [string]$Name,
    [string]$FilePath,
    [string[]]$ArgumentList = @(),
    [string]$WorkingDir = $ProjectRoot,
    [string]$LogFile
  )
  $argStr = if ($ArgumentList.Count) { ($ArgumentList -join " ") } else { "" }
  Write-Orch "INFO" "启动服务: $Name" "exe=$FilePath  args=$argStr  cwd=$WorkingDir"
  Write-Orch "INFO" "$Name 日志文件" $LogFile
  try {
    $p = Start-Process -FilePath $FilePath -ArgumentList $ArgumentList -WorkingDirectory $WorkingDir `
                       -WindowStyle Hidden -RedirectStandardOutput $LogFile -RedirectStandardError ($LogFile + ".err") `
                       -PassThru -NoNewWindow:$false
    Write-OrchOK "$Name 进程已创建" "pid=$($p.Id)  handle=ok"
    return $p
  } catch {
    Write-OrchFATAL "$Name 启动失败" "$($_.Exception.Message)"
    return $null
  }
}

# ================================================================
# MASTER FLOW
# ================================================================
Write-OrchPhase "ORCH BOOT"
Write-Orch "INFO" "项目根目录" $ProjectRoot
Write-Orch "INFO" "日志根目录" $LogDir
Write-Orch "INFO" "运行时间戳" $RunStamp
Write-Orch "INFO" "PowerShell 版本" "$($PSVersionTable.PSVersion)"
Write-Orch "INFO" "OS" "$([Environment]::OSVersion.VersionString)  64bit=$([Environment]::Is64BitOperatingSystem)"

# ---- 1. 先决条件检查 ----
Write-OrchPhase "1: PREREQUISITES"
$prereq = @{ Node=$false; Python=$false; Docker=$false; Npm=$false }
try {
  $nodeVer = (node --version 2>&1).Trim()
  $prereq.Node = $true
  Write-OrchOK "Node.js" $nodeVer
} catch { Write-OrchERR "Node.js 未安装或不在PATH" "后端/前端无法启动 → https://nodejs.org/" }
try {
  $pythonVer = (python --version 2>&1).Trim()
  $prereq.Python = $true
  Write-OrchOK "Python" $pythonVer
} catch { Write-OrchWARN "Python 未安装或不在PATH" "LightRAG/PaddleOCR 将不可用" }
try {
  $dockerVer = (docker version --format "{{.Server.Version}}" 2>&1).Trim()
  $prereq.Docker = $true
  Write-OrchOK "Docker daemon" "server v$dockerVer"
} catch { Write-OrchWARN "Docker daemon 未运行" "Neo4j/RAGFlow 容器将不可用 → 先启动 Docker Desktop" }
if ($prereq.Node) {
  try {
    $npmVer = (npm --version 2>&1).Trim()
    $prereq.Npm = $true
    Write-OrchOK "npm" "v$npmVer"
  } catch { Write-OrchERR "npm 不可用" }
}

# ---- 2. 启动 Docker 容器 (Neo4j / RAGFlow) ----
Write-OrchPhase "2: DOCKER CONTAINERS"
$ComposeFile = Join-Path $ProjectRoot "docker-compose.yml"
if ($prereq.Docker -and (Test-Path $ComposeFile)) {
  Write-Orch "INFO" "docker compose 启动基础容器" "compose=$ComposeFile  project=docmgmt"
  try {
    $cOut = Join-Path $LogDir "docker-up.log"
    & docker compose -f $ComposeFile -p docmgmt up -d neo4j 2>&1 | Tee-Object -FilePath $cOut -Append | Out-Null
    & docker compose -f $ComposeFile -p docmgmt up -d ragflow ragflow-mysql ragflow-es ragflow-minio ragflow-redis 2>&1 | Tee-Object -FilePath $cOut -Append | Out-Null
  } catch { Write-OrchWARN "docker compose up 异常" $_.Exception.Message }
  Start-Sleep -Seconds 2
  $running = docker ps --format "table {{.Names}}\t{{.Status}}" 2>$null
  Write-Orch "INFO" "当前容器清单" ""
  if ($running) { $running | ForEach-Object { Add-Content -Path $GlobalLogFile -Value "  $_" -ErrorAction SilentlyContinue; Write-Host "  $_" } }
} else {
  if (-not $prereq.Docker) { Write-OrchWARN "跳过 Docker 容器" "Docker daemon 未运行" }
  else { Write-OrchWARN "跳过 Docker 容器" "docker-compose.yml 未找到: $ComposeFile" }
}

# ---- 3. 启动后端 ----
Write-OrchPhase "3: BACKEND :3000"
if (-not $prereq.Node) { Write-OrchFATAL "跳过后端" "Node.js 不可用" } else {
  $env:BACKEND_LOG = $BackendLog
  Start-Detached -Name "Backend-Express" -FilePath "node" -ArgumentList @("server.js") `
                 -WorkingDir (Join-Path $ProjectRoot "backend") -LogFile $BackendLog | Out-Null
  Wait-Port -Port 3000 -TimeoutSec 40 -Name "Backend :3000"
  Test-HTTP -Url "http://localhost:3000/api" -Name "Backend API"
}

# ---- 4. 启动 LightRAG ----
Write-OrchPhase "4: LIGHTRAG :8000"
if (-not $prereq.Python) { Write-OrchWARN "跳过 LightRAG" "Python 不可用" } else {
  $env:PYTHONUNBUFFERED = "1"
  Start-Detached -Name "LightRAG-Python" -FilePath "python" -ArgumentList @("-u","main.py") `
                 -WorkingDir (Join-Path $ProjectRoot "services\lightrag-server") -LogFile $LightragLog | Out-Null
  Wait-Port -Port 8000 -TimeoutSec 30 -Name "LightRAG :8000"
  Test-HTTP -Url "http://localhost:8000/api/lightrag/health" -Name "LightRAG health"
}

# ---- 5. 启动 PaddleOCR ----
Write-OrchPhase "5: PADDLEOCR :8001"
if (-not $prereq.Python) { Write-OrchWARN "跳过 PaddleOCR" "Python 不可用" } else {
  Start-Detached -Name "PaddleOCR-Parser" -FilePath "python" -ArgumentList @("-u","main.py") `
                 -WorkingDir (Join-Path $ProjectRoot "services\paddleocr-server") -LogFile $PaddleocrLog | Out-Null
  Wait-Port -Port 8001 -TimeoutSec 30 -Name "PaddleOCR :8001"
  Test-HTTP -Url "http://localhost:8001/api/parse/health" -Name "PaddleOCR health"
}

# ---- 6. 启动前端 Vite ----
Write-OrchPhase "6: FRONTEND VITE :5300"
if (-not $prereq.Node) { Write-OrchFATAL "跳过前端" "Node.js/npm 不可用" } else {
  # 保证后端日志目录存在
  if (-not (Test-Path $LogDir)) { New-Item -ItemType Directory -Force -Path $LogDir | Out-Null }
  # 用 npm run dev，在项目根目录；cmd 包装避免 npm 不能直接重定向
  $cmdArgs = "/c `"cd /d `"$ProjectRoot`" && npm run dev`""
  Start-Detached -Name "Frontend-Vite" -FilePath "cmd.exe" -ArgumentList @("/c","cd /d `"$ProjectRoot`" && npm run dev") `
                 -WorkingDir $ProjectRoot -LogFile $FrontendLog | Out-Null
  Wait-Port -Port 5300 -TimeoutSec 60 -Name "Frontend :5300"
  Test-HTTP -Url "http://localhost:5300/" -Name "Frontend index.html"
}

# ---- 7. 最终状态汇总 ----
Write-OrchPhase "7: FINAL STATUS SUMMARY"
$ports   = @(3000,5300,7474,7687,8000,8001,9380,9381)
$names   = @{3000="Backend";5300="Frontend";7474="Neo4j-HTTP";7687="Neo4j-Bolt";8000="LightRAG";8001="PaddleOCR";9380="RAGFlow-API";9381="RAGFlow-Web"}
foreach ($p in $ports) {
  $up = [bool](Get-NetTCPConnection -LocalPort $p -State Listen -ErrorAction SilentlyContinue)
  if ($up) { Write-OrchOK   "PORT $p ($($names[$p]))" "LISTENING" }
  else     { Write-OrchWARN "PORT $p ($($names[$p]))" "NOT LISTENING" }
}
$ip = (Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*" -or $_.IPAddress -like "172.*" } | Select-Object -First 1).IPAddress
Write-Orch "INFO" "本机访问入口" "前端: http://localhost:5300/   后端API: http://localhost:3000/api"
if ($ip) { Write-Orch "INFO" "手机端 / 局域网入口" "http://${ip}:5300/" }

Write-OrchPhase "STARTUP FINISHED"
Write-Orch "INFO" "日志清单" "总编排: $GlobalLogFile  |  后端: $BackendLog  |  前端: $FrontendLog  |  LightRAG: $LightragLog  |  PaddleOCR: $PaddleocrLog"
Write-Orch "INFO" "停止服务" "见同目录 stop-all.ps1（如果已提供）或: 停止 Docker Desktop + 结束 node/python 进程"
Write-Host ""

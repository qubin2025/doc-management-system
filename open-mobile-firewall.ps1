<#
.SYNOPSIS
  手机端访问工程咨询管理平台 - Windows 防火墙一键放行脚本
  用法: 右键此文件 → "使用 PowerShell 运行"（会自动请求管理员权限）
        或在管理员 PowerShell 中执行:  PowerShell -ExecutionPolicy Bypass -File .\open-mobile-firewall.ps1
  作用: 放行 5300(前端) + 3000(后端API) + 8000(LightRAG) + 8001(PaddleOCR) 入站 TCP
        让手机 / 局域网其他设备可访问本机服务
#>

$ErrorActionPreference = 'Stop'

# 自动提权：如果当前不是管理员，重新以管理员身份启动
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "⚠️  当前非管理员，正在请求提权..." -ForegroundColor Yellow
    $script = $MyInvocation.MyCommand.Path
    Start-Process powershell -Verb RunAs -ArgumentList "-ExecutionPolicy","Bypass","-File","`"$script`""
    exit
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  工程咨询管理平台 - 手机端防火墙放行" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# 待放行端口清单
$rules = @(
    @{Port=5300;  Name="Vite 前端 Dev Server"}
    @{Port=3000;  Name="Express 后端 API"}
    @{Port=8000;  Name="LightRAG 知识引擎"}
    @{Port=8001;  Name="PaddleOCR 解析器"}
    @{Port=7474;  Name="Neo4j HTTP (调试用)"}
    @{Port=9380;  Name="RAGFlow API (调试用)"}
)

foreach ($r in $rules) {
    $displayName = "工程咨询 - $($r.Name) ($($r.Port))"
    try {
        $existing = Get-NetFirewallRule -DisplayName $displayName -ErrorAction SilentlyContinue
        if ($existing) {
            Write-Host "  ✅ 已存在  :$($r.Port)  $($r.Name)" -ForegroundColor Green
        } else {
            New-NetFirewallRule `
                -DisplayName $displayName `
                -Description "允许手机/局域网访问 $($r.Name)" `
                -Direction Inbound `
                -Action Allow `
                -Protocol TCP `
                -LocalPort $r.Port `
                -Profile Any `
                -ErrorAction Stop | Out-Null
            Write-Host "  ✅ 已放行  :$($r.Port)  $($r.Name)" -ForegroundColor Green
        }
    } catch {
        Write-Host "  ❌ 失败    :$($r.Port)  $($r.Name)  → $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  当前可用网络入口" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
$ips = Get-NetIPAddress -AddressFamily IPv4 |
    Where-Object { $_.IPAddress -like "192.168.*" -or $_.IPAddress -like "10.*" -or ($_.IPAddress -like "172.*" -and $_.IPAddress -notlike "172.17.*") } |
    Select-Object -ExpandProperty IPAddress
Write-Host ""
Write-Host "  💻 本机前端      →  http://localhost:5300/" -ForegroundColor White
Write-Host "  💻 本机 API      →  http://localhost:3000/api" -ForegroundColor White
foreach ($ip in $ips) {
    Write-Host "  📱 手机 / 局域网  →  http://${ip}:5300/" -ForegroundColor Yellow
}
Write-Host ""
Write-Host "说明:" -ForegroundColor Cyan
Write-Host "  - 确保手机和电脑在同一 Wi-Fi 网络"
Write-Host "  - 192.168.x.x 通常为 Wi-Fi 网卡，手机应优先使用此 IP"
Write-Host "  - 172.x.x.x 通常是 WSL/Hyper-V 虚拟网卡，手机无法访问"
Write-Host ""
Write-Host "按任意键退出..." -ForegroundColor DarkGray
$null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')

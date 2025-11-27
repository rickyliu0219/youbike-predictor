@echo off@echo off
chcp 65001 >nul
title Stop YouBike Frontend + Cloudflare

echo [1/2] 關閉 Vite (port 5173)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173" ^| findstr LISTENING') do taskkill /PID %%a /F >nul 2>&1

echo [2/2] 關閉 Cloudflared (tunnel)...
taskkill /IM cloudflared.exe /F >nul 2>&1

echo ===========================================
echo ✅ 已關閉 Vite 與 Cloudflare Tunnel
echo ===========================================
pause

@echo off
REM ============================================================
REM  YouBike Predictor - 關閉所有服務
REM  依「佔用的連接埠」找出行程並結束：8000=後端、5173=前端
REM ============================================================
chcp 65001 >nul
title Stop YouBike Predictor

echo [1/3] 關閉後端 FastAPI (port 8000)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8000" ^| findstr LISTENING') do taskkill /PID %%a /T /F >nul 2>&1

echo [2/3] 關閉前端 Vite (port 5173)...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":5173" ^| findstr LISTENING') do taskkill /PID %%a /T /F >nul 2>&1

echo [3/3] 關閉 Cloudflared (tunnel)...
taskkill /IM cloudflared.exe /F >nul 2>&1

echo ============================================================
echo  已全部關閉
echo ============================================================
pause

@echo off
chcp 65001 >nul
title YouBike Predictor - All Services

echo ===========================================
echo [1/3] 啟動後端 FastAPI (http://127.0.0.1:8000) ...
start cmd /k "cd backend && uvicorn main:app --reload --port 8000"

REM 等待 3 秒確保後端啟動
timeout /t 3 /nobreak >nul

echo [2/3] 啟動前端 Vite (http://localhost:5173) ...
start cmd /k "cd frontend && npm run dev"

REM 等待 3 秒確保前端啟動
timeout /t 3 /nobreak >nul

echo [3/3] 啟動 Cloudflare Tunnel (外網網址將顯示於新視窗)...
start cmd /k "cd frontend && cloudflared tunnel --url http://localhost:5173"

echo ===========================================
echo ✅ 所有服務已啟動
echo    - 後端 API: http://127.0.0.1:8000/docs
echo    - 前端頁面: http://localhost:5173
echo    - 外網網址: 請查看 Cloudflared 視窗
echo ===========================================
pause

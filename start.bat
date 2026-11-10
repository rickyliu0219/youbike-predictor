@echo off
REM ============================================================
REM  YouBike Predictor - 啟動所有服務
REM  後端 FastAPI : http://127.0.0.1:8000  （API 文件 /docs）
REM  前端 Vite    : http://localhost:5173
REM  Cloudflare Tunnel（選用）：有安裝 cloudflared 才會開，提供臨時外網網址
REM ============================================================
chcp 65001 >nul
cd /d "%~dp0"
title YouBike Predictor - All Services

if not exist venv\Scripts\python.exe (
    echo [錯誤] 找不到 venv，請先執行 setup.bat
    pause & exit /b 1
)

echo [1/3] 啟動後端 FastAPI (http://127.0.0.1:8000) ...
REM 用 venv 裡的 python 執行 uvicorn，不依賴系統全域套件
start "YouBike Backend" cmd /k "cd /d %~dp0backend && ..\venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000"

REM 等後端載入模型
timeout /t 5 /nobreak >nul

echo [2/3] 啟動前端 Vite (http://localhost:5173) ...
start "YouBike Frontend" cmd /k "cd /d %~dp0frontend && npm run dev"

timeout /t 3 /nobreak >nul

echo [3/3] Cloudflare Tunnel（選用）...
where cloudflared >nul 2>&1
if %errorlevel%==0 (
    start "YouBike Tunnel" cmd /k "cloudflared tunnel --url http://localhost:5173"
    echo       已啟動，外網網址請看 Tunnel 視窗
) else (
    echo       未安裝 cloudflared，略過（只在本機使用不影響）
)

echo ============================================================
echo  已啟動
echo    - 後端 API : http://127.0.0.1:8000/docs
echo    - 前端頁面 : http://localhost:5173
echo  關閉請執行 stop.bat
echo ============================================================
start "" http://localhost:5173
pause

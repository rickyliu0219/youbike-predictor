@echo off
REM ============================================================
REM  YouBike Predictor - 啟動
REM  一般模式（只需 Python）：後端同時提供 API 與網頁 → http://127.0.0.1:8000
REM  開發模式（有 Node.js 且跑過 setup）：另開 Vite 熱更新 → http://localhost:5173
REM  Cloudflare Tunnel（選用）：有安裝 cloudflared 才會開，提供臨時外網網址
REM ============================================================
chcp 65001 >nul
cd /d "%~dp0"
title YouBike Predictor

if not exist venv\Scripts\python.exe (
    echo [錯誤] 找不到 venv，請先執行 setup.bat
    pause & exit /b 1
)

echo [1/3] 啟動後端 FastAPI (http://127.0.0.1:8000) ...
REM 用 venv 裡的 python 執行 uvicorn，不依賴系統全域套件
start "YouBike Backend" cmd /k "cd /d "%~dp0backend" && ..\venv\Scripts\python.exe -m uvicorn main:app --reload --port 8000"

REM 等後端載入模型
timeout /t 6 /nobreak >nul

REM 判斷要用哪種前端模式
set "WEB_URL=http://127.0.0.1:8000"
where npm >nul 2>&1
if not errorlevel 1 if exist frontend\node_modules (
    echo [2/3] 偵測到 Node.js，啟動前端開發模式 Vite ^(http://localhost:5173^) ...
    start "YouBike Frontend" cmd /k "cd /d "%~dp0frontend" && npm run dev"
    set "WEB_URL=http://localhost:5173"
    timeout /t 3 /nobreak >nul
) else (
    echo [2/3] 使用已打包的網頁（由後端提供）
)

echo [3/3] Cloudflare Tunnel（選用）...
where cloudflared >nul 2>&1
if errorlevel 1 (
    echo       未安裝 cloudflared，略過（只在本機使用不影響）
) else (
    start "YouBike Tunnel" cmd /k "cloudflared tunnel --url %WEB_URL%"
    echo       已啟動，外網網址請看 Tunnel 視窗
)

echo ============================================================
echo  已啟動
echo    - 網頁     : %WEB_URL%
echo    - API 文件 : http://127.0.0.1:8000/docs
echo  關閉請執行 stop.bat
echo ============================================================
start "" %WEB_URL%
pause

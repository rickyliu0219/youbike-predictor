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
REM --reload：backend\ 裡的 .py 一存檔就自動重新載入，不用重開 start.bat
REM （只監看 backend\ 資料夾，避免 venv、node_modules 變動造成不必要的重啟）
start "YouBike Backend" /D "%~dp0backend" cmd /k ..\venv\Scripts\python.exe -m uvicorn main:app --port 8000 --reload --reload-dir .

REM 等後端載入模型：最多等 30 秒，每秒檢查一次 8000 port 是否已在監聽
echo       等待後端就緒 ...
for /l %%i in (1,1,30) do (
    netstat -ano | findstr ":8000" | findstr LISTENING >nul && goto backend_ready
    timeout /t 1 /nobreak >nul
)
echo [警告] 後端 30 秒內沒有啟動，請查看「YouBike Backend」視窗的錯誤訊息
:backend_ready

REM 判斷要用哪種前端模式
set "WEB_URL=http://127.0.0.1:8000"
where npm >nul 2>&1
if not errorlevel 1 if exist frontend\node_modules (
    echo [2/3] 偵測到 Node.js，啟動前端開發模式 Vite ^(http://localhost:5173^) ...
    start "YouBike Frontend" /D "%~dp0frontend" cmd /k npm run dev
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

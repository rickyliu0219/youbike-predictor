@echo off
REM ============================================================
REM  YouBike Predictor - 第一次安裝（只需執行一次）
REM  1. 在專案根目錄建立 Python 虛擬環境 venv\
REM  2. 安裝後端套件（backend\requirements.txt）
REM  3. （選用）有 Node.js 才安裝前端開發套件；沒有也能用，
REM     後端會直接提供已打包好的網頁 frontend\dist
REM  需求：Python 3.10 以上（Node.js 18+ 為選用）
REM ============================================================
chcp 65001 >nul
cd /d "%~dp0"

echo [1/3] 檢查 Python ...
where python >nul 2>&1 || (echo [錯誤] 找不到 python，請先安裝 Python 3.10+ 並勾選 Add to PATH & pause & exit /b 1)
python --version

REM venv 搬移資料夾後會失效（裡面寫死了舊路徑），所以舊的 venv 直接重建
if exist venv (
    echo       偵測到舊的 venv，重新建立以避免路徑失效 ...
    rmdir /s /q venv
)

echo [2/3] 建立虛擬環境並安裝後端套件 ...
python -m venv venv || (echo [錯誤] 建立 venv 失敗 & pause & exit /b 1)
call venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r backend\requirements.txt || (echo [錯誤] 後端套件安裝失敗 & pause & exit /b 1)

echo [3/3] 前端開發套件（選用）...
where npm >nul 2>&1
if errorlevel 1 (
    echo       未安裝 Node.js，略過。將使用已打包的網頁，功能完全相同。
) else (
    pushd frontend
    call npm ci || echo       [警告] 前端套件安裝失敗，仍可使用已打包的網頁
    popd
)

echo ============================================================
echo  安裝完成！之後執行 start.bat 即可啟動。
echo ============================================================
pause

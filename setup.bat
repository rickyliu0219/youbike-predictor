@echo off
REM ============================================================
REM  YouBike Predictor - 第一次安裝（只需執行一次）
REM  1. 在專案根目錄建立 Python 虛擬環境 venv\
REM  2. 安裝後端套件（backend\requirements.txt）
REM  3. 安裝前端套件（frontend\node_modules）
REM  需求：Python 3.10 以上、Node.js 18 以上
REM ============================================================
chcp 65001 >nul
cd /d "%~dp0"

echo [1/3] 檢查 Python 與 Node.js ...
where python >nul 2>&1 || (echo [錯誤] 找不到 python，請先安裝 Python 3.10+ 並勾選 Add to PATH & pause & exit /b 1)
where npm    >nul 2>&1 || (echo [錯誤] 找不到 npm，請先安裝 Node.js 18+ & pause & exit /b 1)

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

echo [3/3] 安裝前端套件 ...
pushd frontend
call npm ci || (echo [錯誤] 前端套件安裝失敗 & popd & pause & exit /b 1)
popd

echo ============================================================
echo  安裝完成！之後執行 start.bat 即可啟動。
echo ============================================================
pause

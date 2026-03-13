@echo off
echo ==============================
echo Project Setup Starting
echo ==============================

REM 현재 폴더 기준으로 실행되도록
cd /d %~dp0

echo.
echo Checking Python virtual environment...

IF NOT EXIST ".venv\Scripts\python.exe" (
    echo Creating .venv ...
    python -m venv .venv
) ELSE (
    echo .venv already exists
)

echo.
echo Activating virtual environment...
call .venv\Scripts\activate

echo.
echo Installing Python dependencies...
cd python_server
pip install -r requirements.txt
cd ..

echo.
echo Installing Node dependencies...
cd client
call npm install
cd ..

echo.
echo ==============================
echo Setup Complete
echo ==============================
pause
@echo off
echo ==============================
echo Server Setup Starting
echo ==============================

cd /d %~dp0

echo Checking Python virtual environment...

IF NOT EXIST ".venv\Scripts\python.exe" (
echo Creating .venv ...
python -m venv .venv
)

echo Activating virtual environment...
call .venv\Scripts\activate

echo Installing Python dependencies...
cd python_server
pip install -r requirements.txt
cd ..

echo Installing Node dependencies...
cd client
call npm install

echo Building Client...
call npm run build
cd ..

echo ==============================
echo Server Setup Complete
echo ==============================

pause

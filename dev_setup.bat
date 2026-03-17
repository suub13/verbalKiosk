@echo off
echo ==============================
echo Dev Setup Starting
echo ==============================

cd /d %~dp0

IF NOT EXIST ".venv\Scripts\python.exe" (
echo Creating Python venv...
python -m venv .venv
)

call .venv\Scripts\activate

echo Installing Python dependencies...
cd python_server
pip install -r requirements.txt
cd ..

echo Installing Node dependencies...
cd client
call npm install
cd ..

echo ==============================
echo Dev Setup Complete
echo ==============================

pause

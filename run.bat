@echo off
cd /d %~dp0

echo ==============================
echo Starting Python Server
echo ==============================

start cmd /k "cd /d %~dp0 && call .venv\Scripts\activate && cd python_server && python main.py"

echo ==============================
echo Starting Client Dev Server
echo ==============================

start cmd /k "cd /d %~dp0client && npm run build && npm run dev"

echo.
echo Servers are starting...
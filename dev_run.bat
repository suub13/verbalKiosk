@echo off
cd /d %~dp0

echo ==============================
echo Starting Python Dev Server
echo ==============================

start cmd /k "cd /d %~dp0 && call .venv\Scripts\activate && cd python_server && python main.py"

echo ==============================
echo Starting Vite Dev Server
echo ==============================

start cmd /k "cd /d %~dp0client && npm run dev"

echo ==============================
echo Dev Servers Running
echo ==============================

pause

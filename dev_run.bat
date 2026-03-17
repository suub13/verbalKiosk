@echo off
@REM cd /d %~dp0

@REM echo ==============================
@REM echo Starting Python Dev Server
@REM echo ==============================

start cmd /k "cd /d %~dp0 && call .venv\Scripts\activate && cd python_server && python main.py"

@REM echo ==============================
@REM echo Starting Vite Dev Server
@REM echo ==============================

start cmd /k "cd /d %~dp0client && npm run dev"

@REM echo ==============================
@REM echo Dev Servers Running
@REM echo ==============================

@REM pause

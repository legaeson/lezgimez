@echo off
echo Launching Google Chrome in mobile view...
start chrome --app="http://localhost:8000" --window-size="400,710"
call npm run serve


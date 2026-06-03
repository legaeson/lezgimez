@echo off
rem Set UTF-8 encoding for correct Russian display
chcp 65001 >nul
node scripts/backup.js
pause
@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul || (echo 這台電腦沒有安裝 Node.js，請先到 https://nodejs.org 下載安裝 LTS 版。 & pause & exit /b)
node server.js 8080 --open
pause

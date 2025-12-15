@echo off
echo Installing Printer Service...
cd /d "%~dp0"
npm install --silent
node install-service.cjs
echo Installation complete.
pause

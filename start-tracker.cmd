@echo off
cd /d "%~dp0"
echo.
node scripts\show-network-url.mjs
echo.
npm.cmd run dev

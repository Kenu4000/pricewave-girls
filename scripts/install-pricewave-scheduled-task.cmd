@echo off
setlocal
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0install-pricewave-scheduled-task.ps1" -Time 09:00
if errorlevel 1 (
  echo.
  echo タスク登録に失敗しました。
  pause
  exit /b 1
)
echo.
echo Pricewaveの日次自動実行タスクを登録しました。
pause

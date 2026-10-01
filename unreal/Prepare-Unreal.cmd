@echo off
setlocal
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js is required to bake the webpage scenes. Install Node.js and try again.
  pause
  exit /b 1
)
node --max-old-space-size=8192 tools\export-scene.cjs
if errorlevel 1 (
  echo Export failed. See the error above.
  pause
  exit /b 1
)
echo.
echo Export complete. Open TheLastDance.uproject in Unreal Engine 5.4 or newer.
echo Then choose Tools ^> Execute Python Script and select Content\Python\build_last_dance.py.
pause

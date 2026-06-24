@echo off
echo DevLaunch - Setup
echo.
echo Checking Node.js...
node --version >nul 2>&1
if %errorlevel% neq 0 (
  echo ERROR: Node.js is not installed. Please download it from https://nodejs.org
  pause
  exit /b 1
)
echo Node.js found.
echo.
echo Installing dependencies...
npm install
if %errorlevel% neq 0 (
  echo ERROR: npm install failed. See above for details.
  pause
  exit /b 1
)
echo.
echo Launching DevLaunch...
npm start

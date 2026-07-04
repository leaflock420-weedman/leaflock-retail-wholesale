@echo off
cd /d "%~dp0.."
if not exist "node_modules\express" (
  echo Installing dependencies...
  call npm.cmd install
)
set PORT=4177
:tryport
netstat -ano | findstr ":%PORT% " | findstr LISTENING >nul
if %errorlevel%==0 (
  set /a PORT+=1
  goto tryport
)
echo.
echo LeafLock Wholesale — http://localhost:%PORT%/
echo Admin — http://localhost:%PORT%/admin/
echo Press Ctrl+C to stop.
echo.
set PORT=%PORT%
node server.js
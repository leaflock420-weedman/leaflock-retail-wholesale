@echo off
cd /d "%~dp0.."
if not exist "node_modules\express" (
  echo Installing dependencies...
  call npm.cmd install
)
set PORT=4280
:tryport
netstat -ano | findstr ":%PORT% " | findstr LISTENING >nul
if %errorlevel%==0 (
  set /a PORT+=1
  goto tryport
)
echo.
echo LL Wholesale (isolated copy) — http://localhost:%PORT%/
echo Admin — http://localhost:%PORT%/admin/
echo.
echo This does NOT affect med.leaflock.com.au
echo Press Ctrl+C to stop.
echo.
set PORT=%PORT%
set SITE_URL=http://localhost:%PORT%
set DATA_DIR=data
set NODE_ENV=development
set PROJECT_ID=ll-wholesale
node server.js
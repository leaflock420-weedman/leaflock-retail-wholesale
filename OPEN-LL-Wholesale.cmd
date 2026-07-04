@echo off
REM Opens LL Wholesale in Cursor as a separate workspace (not med.leaflock production)
start "" "%LOCALAPPDATA%\Programs\cursor\Cursor.exe" "%~dp0LL-Wholesale.code-workspace" 2>nul
if errorlevel 1 start "" "cursor" "%~dp0LL-Wholesale.code-workspace" 2>nul
if errorlevel 1 (
  echo Could not find Cursor. Open manually:
  echo   File -^> Open Folder -^> %~dp0
  pause
)
@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\request-publish.ps1"
if errorlevel 1 echo Git push failed. Please read docs/PUBLISHING.md.
pause

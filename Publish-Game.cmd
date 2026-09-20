@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\request-publish.ps1"
if errorlevel 1 echo Publish request failed. Please open Codex and read docs/PUBLISHING.md.
pause

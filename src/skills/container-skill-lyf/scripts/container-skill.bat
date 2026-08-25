@echo off
setlocal EnableExtensions DisableDelayedExpansion

where node.exe >nul 2>nul
if errorlevel 1 (
  echo Error: node.exe is required but was not found in PATH. 1>&2
  exit /b 1
)

node "%~dp0container-skill.js" %*
exit /b %errorlevel%

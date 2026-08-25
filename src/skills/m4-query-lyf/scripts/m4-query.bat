@echo off
setlocal EnableExtensions DisableDelayedExpansion

if not defined M4_BASE_URL set "M4_BASE_URL=http://127.0.0.1:5800"
if not defined M4_APP_ID set "M4_APP_ID=test"
if not defined M4_APP_KEY set "M4_APP_KEY=test"

if "%M4_BASE_URL:~-1%"=="/" set "M4_BASE_URL=%M4_BASE_URL:~0,-1%"

if /I "%~1"=="query" (
  if "%~2"=="" (
    echo Error: query requires a request JSON file. 1>&2
    call :usage 1>&2
    exit /b 2
  )
  call :query "%~2"
  exit /b %errorlevel%
)

if /I "%~1"=="-h" (
  call :usage
  exit /b 0
)

if /I "%~1"=="--help" (
  call :usage
  exit /b 0
)

echo Error: unknown command: %~1 1>&2
call :usage 1>&2
exit /b 2

:query
call :check_dependencies
if errorlevel 1 exit /b 1

if not exist "%~1" (
  echo Error: request JSON file not found: %~1 1>&2
  exit /b 1
)

set "REQUEST_DIR="
for /f "delims=" %%I in ('node.exe -e "const fs=require('fs'),os=require('os'),path=require('path');process.stdout.write(fs.mkdtempSync(path.join(os.tmpdir(),'m4-query-')))"') do set "REQUEST_DIR=%%I"
if not defined REQUEST_DIR (
  echo Error: failed to create a unique temporary directory. 1>&2
  exit /b 1
)

set "REQUEST_FILE=%REQUEST_DIR%\request.json"
set "RESPONSE_FILE=%REQUEST_DIR%\response.json"
set "STATUS_FILE=%REQUEST_DIR%\status.txt"

node -e "const fs=require('fs');const input=process.argv[1];const output=process.argv[2];try{const raw=fs.readFileSync(input,'utf8').replace(/^\uFEFF/,'');const v=JSON.parse(raw);if(!v||typeof v!=='object'||Array.isArray(v)||typeof v.entityName!=='string'||!v.entityName.trim())throw new Error('request JSON must contain a non-empty entityName');const pageNo=v.pageNo===undefined?1:v.pageNo;const pageSize=v.pageSize===undefined?50:v.pageSize;if(!Number.isInteger(pageNo)||pageNo<1)throw new Error('pageNo must be a positive integer');if(!Number.isInteger(pageSize)||pageSize<1)throw new Error('pageSize must be a positive integer');if(v.projection!==undefined&&v.projection!==null&&!Array.isArray(v.projection))throw new Error('projection must be an array or null');if(v.sort!==undefined&&!Array.isArray(v.sort))throw new Error('sort must be an array');if(v.query!==undefined&&v.query!==null&&(typeof v.query!=='object'||Array.isArray(v.query)))throw new Error('query must be an object or null');const n={entityName:v.entityName.trim(),query:v.query===undefined?null:v.query,pageNo,pageSize,projection:v.projection===undefined?null:v.projection,sort:v.sort===undefined?[]:v.sort};fs.writeFileSync(output,JSON.stringify(n),'utf8')}catch(e){console.error('Invalid query request: '+e.message);process.exit(1)}" "%~1" "%REQUEST_FILE%"
if errorlevel 1 (
  call :cleanup
  exit /b 1
)

call :request "%M4_BASE_URL%/api/entity/find/page" "%REQUEST_FILE%"
if errorlevel 1 exit /b 1

if not "%HTTP_STATUS%"=="200" (
  echo Error: POST /api/entity/find/page returned HTTP %HTTP_STATUS%. 1>&2
  if exist "%RESPONSE_FILE%" type "%RESPONSE_FILE%" 1>&2
  call :cleanup
  exit /b 1
)

node -e "const fs=require('fs');const p=process.argv[1];try{const raw=fs.readFileSync(p,'utf8').replace(/^\uFEFF/,'');const v=JSON.parse(raw);process.stdout.write(JSON.stringify(v,null,2)+'\n')}catch(e){console.error('Invalid API response: '+e.message);process.exit(1)}" "%RESPONSE_FILE%"
set "NODE_EXIT=%errorlevel%"
call :cleanup
exit /b %NODE_EXIT%

:check_dependencies
where curl.exe >nul 2>nul
if errorlevel 1 (
  echo Error: curl.exe is required but was not found in PATH. 1>&2
  exit /b 1
)

where node.exe >nul 2>nul
if errorlevel 1 (
  echo Error: node.exe is required but was not found in PATH. 1>&2
  exit /b 1
)
exit /b 0

:request
if defined M4_AUTHORIZATION (
  if defined M4_COOKIE (
    curl.exe -sS --connect-timeout 10 --max-time 60 -o "%RESPONSE_FILE%" -w "%%{http_code}" -X POST -H "xyy-app-id: %M4_APP_ID%" -H "xyy-app-key: %M4_APP_KEY%" -H "Authorization: %M4_AUTHORIZATION%" -H "Content-Type: application/json" -H "Accept: application/json" -b "%M4_COOKIE%" --data-binary "@%~2" "%~1" > "%STATUS_FILE%"
  ) else (
    curl.exe -sS --connect-timeout 10 --max-time 60 -o "%RESPONSE_FILE%" -w "%%{http_code}" -X POST -H "xyy-app-id: %M4_APP_ID%" -H "xyy-app-key: %M4_APP_KEY%" -H "Authorization: %M4_AUTHORIZATION%" -H "Content-Type: application/json" -H "Accept: application/json" --data-binary "@%~2" "%~1" > "%STATUS_FILE%"
  )
) else if defined M4_COOKIE (
  curl.exe -sS --connect-timeout 10 --max-time 60 -o "%RESPONSE_FILE%" -w "%%{http_code}" -X POST -H "xyy-app-id: %M4_APP_ID%" -H "xyy-app-key: %M4_APP_KEY%" -H "Content-Type: application/json" -H "Accept: application/json" -b "%M4_COOKIE%" --data-binary "@%~2" "%~1" > "%STATUS_FILE%"
) else (
  curl.exe -sS --connect-timeout 10 --max-time 60 -o "%RESPONSE_FILE%" -w "%%{http_code}" -X POST -H "xyy-app-id: %M4_APP_ID%" -H "xyy-app-key: %M4_APP_KEY%" -H "Content-Type: application/json" -H "Accept: application/json" --data-binary "@%~2" "%~1" > "%STATUS_FILE%"
)
set "CURL_EXIT=%errorlevel%"

set "HTTP_STATUS="
set /p HTTP_STATUS=<"%STATUS_FILE%"
if not defined HTTP_STATUS set "HTTP_STATUS=000"

if not "%CURL_EXIT%"=="0" (
  echo Error: curl request failed with exit code %CURL_EXIT%. 1>&2
  if exist "%RESPONSE_FILE%" type "%RESPONSE_FILE%" 1>&2
  call :cleanup
  exit /b 1
)
exit /b 0

:cleanup
if defined RESPONSE_FILE if exist "%RESPONSE_FILE%" del /q "%RESPONSE_FILE%" >nul 2>nul
if defined STATUS_FILE if exist "%STATUS_FILE%" del /q "%STATUS_FILE%" >nul 2>nul
if defined REQUEST_FILE if exist "%REQUEST_FILE%" del /q "%REQUEST_FILE%" >nul 2>nul
if defined REQUEST_DIR if exist "%REQUEST_DIR%" rd /q "%REQUEST_DIR%" >nul 2>nul
set "RESPONSE_FILE="
set "STATUS_FILE="
set "REQUEST_FILE="
set "REQUEST_DIR="
exit /b 0

:usage
echo Usage:
echo   skill\m4-query\scripts\m4-query.bat query ^<request-json-file^>
echo.
echo Commands:
echo   query  Query data with POST /api/entity/find/page.
echo.
echo Environment:
echo   M4_BASE_URL       M4 service base URL, default: http://127.0.0.1:5800
echo   M4_APP_ID         xyy-app-id header, default: test
echo   M4_APP_KEY        xyy-app-key header, default: test
echo   M4_AUTHORIZATION  Optional Authorization value
echo   M4_COOKIE         Optional browser session cookie
exit /b 0

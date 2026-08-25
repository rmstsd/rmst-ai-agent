@echo off
setlocal EnableExtensions DisableDelayedExpansion

set "SCRIPT_DIR=%~dp0"
for %%I in ("%SCRIPT_DIR%..") do set "SKILL_DIR=%%~fI"
for %%I in ("%SKILL_DIR%\..\..") do set "REPO_ROOT=%%~fI"

if not defined M4_BASE_URL set "M4_BASE_URL=http://127.0.0.1:5800"
if not defined M4_APP_ID set "M4_APP_ID=test"
if not defined M4_APP_KEY set "M4_APP_KEY=test"

if "%M4_BASE_URL:~-1%"=="/" set "M4_BASE_URL=%M4_BASE_URL:~0,-1%"
set "AUTH_ARGS="
if defined M4_AUTHORIZATION set "AUTH_ARGS=%AUTH_ARGS% -H "Authorization: %M4_AUTHORIZATION%""
if defined M4_COOKIE set "AUTH_ARGS=%AUTH_ARGS% -b "%M4_COOKIE%""

:dispatch_get
if /I "%~1"=="get" (
  if "%~2"=="" (
    echo Error: get requires a business object name. 1>&2
    call :usage 1>&2
    exit /b 2
  )
  goto run_get
)

if /I "%~1"=="list" goto run_list

if /I "%~1"=="save" (
  if "%~2"=="" (
    echo Error: save requires a JSON file path. 1>&2
    call :usage 1>&2
    exit /b 2
  )
  goto run_save
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

:run_get
call :get "%~2"
exit /b %errorlevel%

:run_list
call :list
exit /b %errorlevel%

:run_save
call :save "%~2"
exit /b %errorlevel%

:get
call :check_dependencies
if errorlevel 1 exit /b 1

call :request GET "%M4_BASE_URL%/api/meta/entities"
if errorlevel 1 exit /b 1
if not "%HTTP_STATUS%"=="200" (
  echo Error: GET /api/meta/entities returned HTTP %HTTP_STATUS%. 1>&2
  type "%RESPONSE_FILE%" 1>&2
  call :cleanup
  exit /b 1
)

node -e "const fs=require('fs');const p=process.argv[1];const n=process.argv[2];try{const v=JSON.parse(fs.readFileSync(p,'utf8'));if(!Object.prototype.hasOwnProperty.call(v,n)){console.error('Business object not found: '+n);process.exit(4)}process.stdout.write(JSON.stringify(v[n],null,2)+'\n')}catch(e){console.error('Invalid API response: '+e.message);process.exit(1)}" "%RESPONSE_FILE%" "%~1"
set "NODE_EXIT=%errorlevel%"
call :cleanup
exit /b %NODE_EXIT%

:list
call :check_dependencies
if errorlevel 1 exit /b 1

call :request GET "%M4_BASE_URL%/api/meta/entities"
if errorlevel 1 exit /b 1
if not "%HTTP_STATUS%"=="200" (
  echo Error: GET /api/meta/entities returned HTTP %HTTP_STATUS%. 1>&2
  type "%RESPONSE_FILE%" 1>&2
  call :cleanup
  exit /b 1
)

node -e "const fs=require('fs');const p=process.argv[1];try{const v=JSON.parse(fs.readFileSync(p,'utf8'));process.stdout.write(JSON.stringify(v,null,2)+'\n')}catch(e){console.error('Invalid API response: '+e.message);process.exit(1)}" "%RESPONSE_FILE%"
set "NODE_EXIT=%errorlevel%"
call :cleanup
exit /b %NODE_EXIT%

:save
call :check_dependencies
if errorlevel 1 exit /b 1

if not exist "%~1" (
  echo Error: JSON file not found: %~1 1>&2
  exit /b 1
)

node -e "const fs=require('fs');const p=process.argv[1];try{const v=JSON.parse(fs.readFileSync(p,'utf8'));if(!v||typeof v!=='object'||Array.isArray(v)||!v.name){console.error('JSON must be an object with a non-empty name field');process.exit(1)}}catch(e){console.error('Invalid JSON: '+e.message);process.exit(1)}" "%~1"
if errorlevel 1 exit /b 1

call :request POST "%M4_BASE_URL%/api/meta/entity" "%~1"
if errorlevel 1 exit /b 1
if not "%HTTP_STATUS%"=="200" (
  echo Error: POST /api/meta/entity returned HTTP %HTTP_STATUS%. 1>&2
  type "%RESPONSE_FILE%" 1>&2
  call :cleanup
  exit /b 1
)

echo Business object saved successfully.
if exist "%RESPONSE_FILE%" (
  for %%I in ("%RESPONSE_FILE%") do if %%~zI GTR 0 type "%RESPONSE_FILE%"
)
call :cleanup
exit /b 0

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
set "REQUEST_DIR="
for /f "delims=" %%I in ('node.exe -e "const fs=require('fs'),os=require('os'),path=require('path');process.stdout.write(fs.mkdtempSync(path.join(os.tmpdir(),'m4-entity-')))"') do set "REQUEST_DIR=%%I"
if not defined REQUEST_DIR (
  echo Error: failed to create a unique temporary directory. 1>&2
  exit /b 1
)
set "RESPONSE_FILE=%REQUEST_DIR%\response.json"
set "STATUS_FILE=%REQUEST_DIR%\status.txt"

if /I "%~1"=="GET" (
  curl.exe -sS -o "%RESPONSE_FILE%" -w "%%{http_code}" -H "xyy-app-id: %M4_APP_ID%" -H "xyy-app-key: %M4_APP_KEY%" -H "Accept: application/json" %AUTH_ARGS% "%~2" > "%STATUS_FILE%"
) else (
  curl.exe -sS -o "%RESPONSE_FILE%" -w "%%{http_code}" -X POST -H "xyy-app-id: %M4_APP_ID%" -H "xyy-app-key: %M4_APP_KEY%" -H "Content-Type: application/json" %AUTH_ARGS% --data-binary "@%~3" "%~2" > "%STATUS_FILE%"
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
if defined REQUEST_DIR if exist "%REQUEST_DIR%" rd /q "%REQUEST_DIR%" >nul 2>nul
set "RESPONSE_FILE="
set "STATUS_FILE="
set "REQUEST_DIR="
exit /b 0

:usage
echo Usage:
echo   scripts\m4-entity.bat get ^<business-object-name^>
echo   scripts\m4-entity.bat list
echo   scripts\m4-entity.bat save ^<json-file-path^>
echo.
echo Commands:
echo   get   Query one business object from GET /api/meta/entities.
echo   list  Query and print all business objects.
echo   save  Validate and POST a complete JSON configuration.
echo.
echo Environment:
echo   M4_BASE_URL  M4 service base URL, default: http://127.0.0.1:5800
echo   M4_APP_ID    xyy-app-id header, default: test
echo   M4_APP_KEY   xyy-app-key header, default: test
echo   M4_AUTHORIZATION  Optional Authorization value, for example: Bearer ^<token^>
echo   M4_COOKIE   Optional browser session cookie
exit /b 0

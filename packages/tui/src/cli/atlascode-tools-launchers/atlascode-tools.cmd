@echo off
setlocal
if not defined __ATLASCODE_TOOLS_RUNTIME_EXECUTABLE (
  echo AtlasCode atlascode-tools runtime is unavailable. Restart AtlasCode. 1>&2
  exit /b 1
)
"%__ATLASCODE_TOOLS_RUNTIME_EXECUTABLE%" "%~dp0..\atlascode-tools.js" %*
exit /b %errorlevel%

@echo off
echo ===================================================
echo Logging out of current session...
echo ===================================================
set "PATH=C:\Program Files\nodejs;%PATH%"
call npx firebase logout
echo ===================================================
echo Opening Firebase Login...
echo Please log in with the account that owns/manages:
echo anovixtechnologies
echo ===================================================
call npx firebase login
echo ===================================================
echo Firebase Login completed.
echo You can close this window and reply "deploy"!
echo ===================================================
pause

@echo off
cd /d "%~dp0"
echo Avvio server AlchemistCodeDB...
echo URL: http://localhost:8080/www.alchemistcodedb.com/index.html
echo Premi CTRL+C per fermare
echo.
python server.py ".."
pause

@echo off
REM AgenTo SaaS - Script de desarrollo para Windows
REM Limpia puertos y inicia servidores

echo.
echo =====================================
echo AgenTo SaaS - Servidor de Desarrollo
echo =====================================
echo.

echo [1/3] Limpiando puertos 3000 y 3001...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3000" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":3001" ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
echo     Puertos limpiados
echo.

timeout /t 2 /nobreak >nul

echo [2/3] Iniciando servidores...
echo     Frontend: http://localhost:3001
echo     Backend:  http://localhost:3000
echo.

echo [3/3] Presiona Ctrl+C para detener
echo.
npm run dev

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Error al iniciar servidores. Codigo: %ERRORLEVEL%
    pause
)

@echo off
REM AgenTo SaaS - Frontend Only (para pruebas rápidas)

echo.
echo ============================================================
echo    AgenTo Frontend - Iniciando en puerto 3004
echo ============================================================
echo.

REM Verificar Node.js
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js no está instalado.
    pause
    exit /b 1
)

cd packages\frontend
echo Instalando dependencias (si es necesario)...
call npm install >nul 2>&1
echo Iniciando servidor...
npm run dev

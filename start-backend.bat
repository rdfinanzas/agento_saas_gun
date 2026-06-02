@echo off
REM AgenTo SaaS - Backend Only (para pruebas rápidas)

echo.
echo ============================================================
echo    AgenTo Backend - Iniciando en puerto 3000
echo ============================================================
echo.

REM Verificar Bun
where bun >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Bun no está instalado. Instálalo desde https://bun.sh
    pause
    exit /b 1
)

cd packages\server
echo Iniciando servidor...
bun run dev

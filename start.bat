@echo off
REM AgenTo SaaS - Development Startup Script
REM Arquitectura: Backend (Bun) + Frontend (Next.js)
REM OpenCode está integrado en el backend

echo.
echo ============================================================
echo    AgenTo SaaS - Iniciando servicios de desarrollo
echo ============================================================
echo.

REM Verificar que Bun está instalado
where bun >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Bun no está instalado. Instálalo desde https://bun.sh
    pause
    exit /b 1
)

REM Verificar que Node.js está instalado
where node >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js no está instalado.
    pause
    exit /b 1
)

echo [1/2] Iniciando Backend (Bun + Hono) en puerto 3000...
start "AgenTo Backend" cmd /k "cd /d %~dp0packages\server && bun run dev"
timeout /t 3 /nobreak >nul

echo [2/2] Iniciando Frontend (Next.js) en puerto 3004...
start "AgenTo Frontend" cmd /k "cd /d %~dp0packages\frontend && npm run dev"
timeout /t 3 /nobreak >nul

echo.
echo ============================================================
echo    Servicios iniciados correctamente
echo ============================================================
echo.
echo    Backend:  http://localhost:3000
echo    Frontend: http://localhost:3004
echo    Health:   http://localhost:3000/health
echo.
echo    Presiona cualquier tecla para cerrar esta ventana
echo    (Los servicios seguirán corriendo en sus ventanas)
echo.
pause >nul

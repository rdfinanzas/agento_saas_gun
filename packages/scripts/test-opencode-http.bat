@echo off
REM Test Script - OpenCode HTTP Integration (Windows)
REM Prueba la comunicación HTTP con el servidor de OpenCode

echo ============================================================
echo    Test - Integración HTTP con OpenCode
echo ============================================================

REM ============================================
REM 1. Verificar servidor OpenCode
REM ============================================
echo.
echo [1/3] Verificando servidor OpenCode...

curl -s http://localhost:4096/session/status >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Servidor OpenCode no responde
    echo Inicia el servidor con: cd packages\opencode-fork\packages\opencode ^&^& bun run src/server/server.ts
    pause
    exit /b 1
)
echo [OK] Servidor OpenCode responde

REM ============================================
REM 2. Verificar backend
REM ============================================
echo.
echo [2/3] Verificando backend...

curl -s http://localhost:3000/health >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Backend no responde
    echo Inicia el backend con: cd packages\backend ^&^& npm run start:dev
    pause
    exit /b 1
)
echo [OK] Backend responde

REM ============================================
REM 3. Probar health check del adaptador
REM ============================================
echo.
echo [3/3] Probando health check...

curl -s http://localhost:4096/session/status

echo.
echo ============================================================
echo    [OK] Todos los tests pasaron
echo ============================================================
echo.
echo La integración HTTP está lista para usar.
echo.
pause

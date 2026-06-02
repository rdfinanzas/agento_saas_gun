@echo off
REM AgenTo SaaS - Detener servicios

echo.
echo ============================================================
echo    Deteniendo servicios de AgenTo
echo ============================================================
echo.

echo Buscando procesos de Bun (Backend)...
for /f "tokens=2" %%i in ('tasklist /FI "IMAGENAME eq bun.exe" /FO LIST ^| findstr /C:"PID:"') do (
    echo Terminando proceso %%i...
    taskkill /PID %%i /F >nul 2>&1
)

echo Buscando procesos de Node (Frontend)...
for /f "tokens=2" %%i in ('tasklist /FI "IMAGENAME eq node.exe" /FO LIST ^| findstr /C:"PID:"') do (
    REM Solo matar procesos de node que estén corriendo Next.js
    wmic process where "ProcessId=%%i and CommandLine like '%%next%%'" call terminate >nul 2>&1
)

echo.
echo Servicios detenidos.
echo.
pause

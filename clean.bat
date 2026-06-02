@echo off
REM AgenTo SaaS - Limpiar logs y caché

echo.
echo ============================================================
echo    Limpiando logs y caché de AgenTo
echo ============================================================
echo.

echo Limpiando logs del servidor...
if exist "packages\server\logs" (
    rmdir /s /q "packages\server\logs"
    echo Logs del servidor eliminados.
)

echo Limpiando logs del frontend...
if exist "packages\frontend\.next" (
    rmdir /s /q "packages\frontend\.next"
    echo Caché de Next.js eliminado.
)

echo Limpiando node_modules de los paquetes...
if exist "packages\server\node_modules\.cache" (
    rmdir /s /q "packages\server\node_modules\.cache"
    echo Caché de Bun eliminado.
)

echo.
echo Limpieza completada.
echo.
pause

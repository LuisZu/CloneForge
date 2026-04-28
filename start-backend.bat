@echo off
REM ─────────────────────────────────────────────────────────────────────────────
REM  CloneForge - Inicio manual del backend Node.js
REM  Ejecutar este archivo si el backend no se inició automáticamente con PM2.
REM ─────────────────────────────────────────────────────────────────────────────

cd /d "%~dp0backend"

IF NOT EXIST ".env" (
    echo [!] No se encontro el archivo .env en backend\
    echo     Copia backend\.env.example a backend\.env y ajusta los valores.
    pause
    exit /b 1
)

echo [>] Iniciando CloneForge Backend en http://localhost:3001
echo     Presiona Ctrl+C para detenerlo.
echo.
node src/index.js
pause

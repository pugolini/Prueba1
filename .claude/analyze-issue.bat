@echo off
REM Token Saver - Análisis Local de Issues para Ahorro de Tokens
REM Este script analiza una tarea usando Qwen Obrero (local) antes de consultar Kimi/Claude
REM 
REM Uso: analyze-issue "descripción de la tarea" [ruta] [archivo-salida]
REM Ejemplo: analyze-issue "Fix bug in ChartComponent websocket" frontend/src brief-chart.json

setlocal enabledelayedexpansion

chcp 65001 >nul

echo.
echo ╔══════════════════════════════════════════════════════════════════╗
echo ║           TOKEN SAVER - Análisis Local (Qwen Obrero)             ║
echo ║              Ahorra hasta 80%% de tokens en Kimi/Claude            ║
echo ╚══════════════════════════════════════════════════════════════════╝
echo.

REM Verificar argumentos
if "%~1"=="" (
    echo ❌ Error: Debes proporcionar una descripción de la tarea
    echo.
    echo Uso:
    echo   analyze-issue "descripción de la tarea" [ruta] [archivo-salida]
    echo.
    echo Ejemplos:
    echo   analyze-issue "Fix websocket connection bug"
    echo   analyze-issue "Refactor useStore hook" frontend/src
    echo   analyze-issue "Add tests for trading API" . trading-brief.json
    echo.
    exit /b 1
)

set "TASK=%~1"
set "PATH_ARG=%~2"
set "OUTPUT_ARG=%~3"

REM Valores por defecto
if "%PATH_ARG%"=="" set "PATH_ARG=."
if "%OUTPUT_ARG%"=="" set "OUTPUT_ARG=.claude\briefs\brief-%RANDOM%.json"

echo 📝 Tarea: %TASK%
echo 📁 Ruta: %PATH_ARG%
echo 💾 Output: %OUTPUT_ARG%
echo.

REM Verificar que Ollama está corriendo
echo 🔍 Verificando Ollama...
ollama list >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Error: Ollama no está corriendo
    echo    Inicia Ollama con: ollama serve
    exit /b 1
)

echo ✅ Ollama disponible
echo.

REM Crear directorio de briefs si no existe
if not exist ".claude\briefs" mkdir ".claude\briefs"

REM Ejecutar preprocessor.js
echo 🚀 Iniciando análisis local...
echo ⏳ Esto puede tomar 30-60 segundos dependiendo del tamaño del proyecto...
echo.

node "%~dp0preprocessor.js" --task "%TASK%" --path "%PATH_ARG%" --output "%OUTPUT_ARG%"

if %errorlevel% neq 0 (
    echo.
    echo ❌ Error en el análisis
    exit /b 1
)

echo.
echo ╔══════════════════════════════════════════════════════════════════╗
echo ║                    ✅ ANÁLISIS COMPLETADO                        ║
echo ╠══════════════════════════════════════════════════════════════════╣
echo ║                                                                  ║
echo ║  Ahora puedes usar este brief con Kimi/Claude:                   ║
echo ║                                                                  ║
echo ║  1. Copia el contenido del brief generado                        ║
echo ║  2. Pégalo en tu conversación con Kimi/Claude                    ║
echo ║  3. Pide que resuelva la tarea basándose en el brief             ║
echo ║                                                                  ║
echo ║  📄 Brief: %OUTPUT_ARG%         ║
echo ║                                                                  ║
echo ╚══════════════════════════════════════════════════════════════════╝
echo.

REM Mostrar contenido del brief (resumen)
echo 📋 Resumen del brief:
echo -------------------
type "%OUTPUT_ARG%" | findstr "task_summary" | head -1
type "%OUTPUT_ARG%" | findstr "relevant_files" | head -1
type "%OUTPUT_ARG%" | findstr "estimated_tokens_saved" | head -1
echo.

echo 💡 Tip: Usa el brief completo para obtener el máximo ahorro de tokens
echo.

endlocal

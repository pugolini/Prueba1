@echo off
REM Delegar tarea al Obrero Local (Qwen)
REM Uso: delegar-obrero "prompt" [archivo-contexto]

setlocal enabledelayedexpansion

if "%~1"=="" (
    echo Uso: delegar-obrero "prompt" [archivo-contexto]
    echo Ejemplo: delegar-obrero "genera un test para la funcion parseSMA"
    exit /b 1
)

set PROMPT=%~1
set CONTEXT=%~2

echo ========================================
echo [OBRERO LOCAL] Delegando tarea a Qwen...
echo ========================================
echo Prompt: %PROMPT%
if not "%CONTEXT%"=="" (
    echo Contexto: %CONTEXT%
)
echo ========================================

REM Construir comando Ollama
if not "%CONTEXT%"=="" (
    for /f "delims=" %%a in ('type "%CONTEXT%"') do set "FILE_CONTENT=%%a"
    echo %FILE_CONTENT% | ollama run qwen-obrero "%PROMPT%"
) else (
    ollama run qwen-obrero "%PROMPT%"
)

echo.
echo [Obrero] Tarea completada.

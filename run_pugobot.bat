@echo off
setlocal

:: Cambiamos al directorio del proyecto para encontrar clean_ports.py
cd /d "c:\Programacion\Prueba1"

echo [1/3] Limpiando procesos previos (Puerto 8001 y 5174)...
python clean_ports.py

echo.
echo [2/3] Iniciando Backend en puerto 8005...
cd /d "c:\Programacion\Prueba1\backend"
start "Pugobot Backend" cmd /k "set PYTHONPATH=. && python -m app.main"

echo [3/3] Iniciando Frontend en puerto 5174...
cd /d "c:\Programacion\Prueba1\frontend"
start "Pugobot Frontend" cmd /k "npm run dev"

echo.
echo ===========================================
echo   TERMINAL PUGOBOT INICIADO CORRECTAMENTE
echo   Backend:  http://127.0.0.1:8005
echo   Frontend: http://localhost:5174
echo ===========================================
echo.
echo Mantenga estas ventanas abiertas para operar.
pause

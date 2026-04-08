import os
import signal
import subprocess
import sys

def kill_process_on_port(port):
    print(f"Buscando procesos en el puerto {port}...")
    try:
        # Comando para encontrar el PID en el puerto
        cmd = f"netstat -aon | findstr LISTENING | findstr :{port}"
        output = subprocess.check_output(cmd, shell=True).decode()
        
        for line in output.strip().split("\n"):
            parts = line.split()
            if len(parts) > 4:
                pid = parts[-1]
                print(f"Finalizando proceso con PID {pid} en puerto {port}...")
                subprocess.run(f"taskkill /F /PID {pid}", shell=True, capture_output=True)
    except subprocess.CalledProcessError:
        print(f"No se encontraron procesos activos en el puerto {port}.")
    except Exception as e:
        print(f"Error al limpiar puerto {port}: {e}")

if __name__ == "__main__":
    kill_process_on_port(8001)
    kill_process_on_port(5174)

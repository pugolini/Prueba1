import socket
import logging

logging.basicConfig(level=logging.INFO)

def check_port(ip, port):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    s.settimeout(1)
    try:
        s.connect((ip, port))
        logging.info(f"¡PUERTO {port} ABIERTO! Responde a nivel TCP.")
        # Intentar ver si es un servidor HTTP/WS (las cabeceras de Rithmic)
        s.sendall(b"GET / HTTP/1.1\r\nHost: 127.0.0.1\r\n\r\n")
        data = s.recv(1024)
        logging.info(f"Respuesta del puerto {port}: {data[:50]}...")
        return True
    except Exception as e:
        logging.error(f"Puerto {port} cerrado o bloqueado por Firewall/Antivirus: {e}")
        return False
    finally:
        s.close()

if __name__ == "__main__":
    print("--- INICIANDO DIAGNÓSTICO DE CONEXIÓN RITHMIC ---")
    puertos_a_probar = [3010, 3011, 3012, 3013, 11000, 12000, 5678]
    for p in puertos_a_probar:
        check_port("127.0.0.1", p)
    print("--- FIN DEL DIAGNÓSTICO ---")

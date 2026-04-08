import socket
import sys

def test_bind(port):
    s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        s.bind(("127.0.0.1", port))
        print(f"OK: El puerto {port} está LIBRE. Nada lo está usando.")
    except socket.error as e:
        print(f"ERROR: El puerto {port} ya está SIENDO USADO por otra aplicación o bloqueado por el sistema.")
        print(f"Detalle: {e}")
    finally:
        s.close()

if __name__ == "__main__":
    test_bind(11000)
    test_bind(12000)
    test_bind(3010)

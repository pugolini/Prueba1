import socket

def probe_3010():
    target_host = "127.0.0.1"
    target_port = 3010
    
    print(f"Sondeando puerto {target_port}...")
    try:
        # Intentamos una conexion TCP cruda
        client = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
        client.settimeout(2)
        client.connect((target_host, target_port))
        
        print("¡CONEXION TCP ESTABLECIDA!")
        
        # Enviamos un saludo HTTP para ver si es un WebSocket
        client.send(b"GET / HTTP/1.1\r\nHost: localhost\r\n\r\n")
        response = client.recv(4096)
        
        print(f"Respuesta recibida: {response[:100]}")
        client.close()
        return True
    except Exception as e:
        print(f"Fallo en la sonda: {e}")
        return False

if __name__ == "__main__":
    probe_3010()

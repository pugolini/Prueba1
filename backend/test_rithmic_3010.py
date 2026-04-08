import asyncio
import websockets
import json

async def test_3010():
    uri = "ws://127.0.0.1:3010"
    print(f"Probando conexión a la 'Puerta Secreta' de Rithmic en {uri}...")
    try:
        async with websockets.connect(uri, timeout=5) as ws:
            print("¡ÉXITO REAL! Conectado al Bridge de Rithmic en el puerto 3010.")
            # Intentar mandar un saludo básico de Rithmic si fuera necesario
            # Pero solo con conectar ya sabemos que la puerta está abierta
            return True
    except Exception as e:
        print(f"Fallo en puerto 3010: {e}")
        return False

if __name__ == "__main__":
    asyncio.run(test_3010())

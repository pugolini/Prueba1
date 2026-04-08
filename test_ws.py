import asyncio
import websockets
import json

async def test_ws():
    uri = "ws://localhost:8001/ws/prices/NAS100.pro"
    try:
        async with websockets.connect(uri) as websocket:
            print("Conectado exitosamente al WebSocket")
            for _ in range(3):
                msg = await websocket.recv()
                print(f"Recibido: {msg}")
    except Exception as e:
        print(f"Error en la conexión: {e}")

if __name__ == "__main__":
    asyncio.run(test_ws())

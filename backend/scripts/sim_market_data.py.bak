import asyncio
import json
import random
import time
import websockets

async def simulate_market():
    uri = "ws://127.0.0.1:8000/ws/orderflow/NAS100.fs"
    print(f"Iniciando Simulador Institucional en {uri}")
    
    try:
        async with websockets.connect(uri) as websocket:
            print("Conectado al Terminal de Trading")
            
            base_price = 18500.0
            cvd = 0
            
            while True:
                # 1. Simular un Trade GIGANTE (Para forzar detección)
                side = random.choice(['buy', 'sell'])
                size = random.randint(200, 500) # Gigantes para el filtro
                
                # Movimiento de precio sutil
                base_price += (0.25 if side == 'buy' else -0.25)
                cvd += (size if side == 'buy' else -size)
                
                trade_msg = {
                    "type": "trade",
                    "symbol": "NAS100.fs",
                    "price": base_price,
                    "quantity": size,
                    "side": side,
                    "time": int(time.time() * 1000)
                }
                
                # 2. Simular Heatmap (Liquidez en el libro)
                levels = []
                for i in range(-5, 5):
                    levels.append({
                        "p": base_price + (i * 0.25),
                        "s": random.randint(10, 150) if abs(i) > 2 else 5
                    })
                
                heatmap_msg = {
                    "type": "heatmap",
                    "time": int(time.time()),
                    "data": levels
                }
                
                # 3. Enviar al WebSocket
                await websocket.send(json.dumps(trade_msg))
                await websocket.send(json.dumps(heatmap_msg))
                
                # Velocidad del simulador (Simula mercado activo)
                delay = random.uniform(0.1, 0.5)
                await asyncio.sleep(delay)
                
                if random.random() > 0.95:
                    print(f"CVD: {cvd} | Precio: {base_price}")

    except Exception as e:
        print(f"Error en el simulador: {e}")

if __name__ == "__main__":
    asyncio.run(simulate_market())

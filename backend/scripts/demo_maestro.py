import asyncio
import websockets
import json
import random
import time

# Script Limpio de Unicode para Windows
async def run_demo():
    url = "ws://127.0.0.1:8000/ws/orderflow/NAS100.fs"
    print(f"Iniciando Simulador Institucional (MAESTRO) en {url}")
    
    try:
        async with websockets.connect(url) as ws:
            print("Conectado al Terminal de Vuelo")
            
            base_price = 18250.0
            
            # Mensaje inicial para despertar al frontend
            await ws.send(json.dumps({
                "type": "status",
                "market_open": True,
                "mt5_connected": True,
                "symbol": "NAS100.fs"
            }))

            while True:
                # Trades masivos para activar setups (Adrianus Playbook)
                side = random.choice(['buy', 'sell'])
                size = random.randint(300, 800)
                
                base_price += (0.25 if side == 'buy' else -0.25)
                
                # Mensaje de Ticks (Agregado)
                trade = {
                    "type": "tick_burst",
                    "data": [{
                        "time": int(time.time() * 1000),
                        "price": base_price,
                        "volume": size,
                        "side": side
                    }]
                }
                await ws.send(json.dumps(trade))
                
                # Inyectar liquidez estática (Heatmap)
                if random.random() > 0.8:
                    heatmap = {
                        "type": "heatmap",
                        "data": {
                            str(base_price + i*0.25): random.randint(100, 400)
                            for i in range(-5, 5)
                        }
                    }
                    await ws.send(json.dumps(heatmap))

                await asyncio.sleep(0.1)

    except Exception as e:
        print(f"Error en el simulador: {e}")

if __name__ == "__main__":
    asyncio.run(run_demo())

import asyncio
import websockets
import json
import sys

# Forzar salida en UTF-8
if sys.stdout.encoding != 'utf-8':
    sys.stdout.reconfigure(encoding='utf-8')

async def test_orderflow():
    # El servidor corre en el 8005
    # Aumentamos el limite del cliente para que no muera con el heatmap
    uri = "ws://127.0.0.1:8005/ws/orderflow/NAS100.fs"
    print(f"Conectando a {uri} (max_size=10MB)...")
    
    try:
        # Aumentamos max_size a 10MB para soportar el heatmap masivo si llega
        async with websockets.connect(uri, max_size=10*1024*1024) as websocket:
            print("CONECTADO. Buscando BIG TRADES (30 segundos)...")
            count = 0
            # Vamos a correr por 30 segundos
            start_time = asyncio.get_event_loop().time()
            
            while (asyncio.get_event_loop().time() - start_time) < 30:
                try:
                    message = await asyncio.wait_for(websocket.recv(), timeout=1.0)
                    data = json.loads(message)
                    m_type = data.get("type")
                    
                    if m_type == "big_trade":
                        print(f"!!! [BIG_TRADE] Price: {data.get('price')} Size: {data.get('size')} Side: {data.get('side')}")
                    elif m_type == "price_update":
                        # Solo loguear si hay volumen (agresion)
                        if data.get('volume', 0) > 0:
                            print(f"[TRADE] {data.get('price')} vol: {data.get('volume')} side: {data.get('side', '?')}")
                    elif m_type == "status_update":
                        if not data.get('ping'):
                            print(f"[STATUS] {data}")
                    
                except asyncio.TimeoutError:
                    continue
                except Exception as e:
                    print(f"Error en recepción: {e}")
                    break
                    
    except Exception as e:
        print(f"ERROR: {e}")

if __name__ == "__main__":
    asyncio.run(test_orderflow())

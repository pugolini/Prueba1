import requests
import time
import json

def test_historical_endpoint():
    symbol = "NQ"
    timeframe = "1m"
    url = f"http://127.0.0.1:8000/api/rithmic/historical-delta/{symbol}?timeframe={timeframe}"
    
    print(f"--- Probando Endpoint de Delta Histórico: {symbol} ({timeframe}) ---")
    try:
        start_time = time.time()
        response = requests.get(url, timeout=30)
        end_time = time.time()
        
        print(f"Status Code: {response.status_code}")
        print(f"Tiempo de respuesta: {end_time - start_time:.2f}s")
        
        if response.status_code == 200:
            data = response.json()
            print(f"Número de velas recibidas: {len(data)}")
            if data:
                # Mostrar los primeros 3 para verificar formato {ts: delta}
                first_keys = list(data.keys())[:3]
                for k in first_keys:
                    print(f"  TS: {k} -> Delta: {data[k]}")
            else:
                print("ADVERTENCIA: El endpoint devolvió un objeto vacío {}. Posible fallo en History Plant o falta de conexión.")
        else:
            print(f"ERROR: {response.text}")
            
    except Exception as e:
        print(f"ERROR conectando al backend: {e}")

if __name__ == "__main__":
    test_historical_endpoint()

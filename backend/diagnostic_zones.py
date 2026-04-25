import sys
import os

# Añadir el path del backend
sys.path.append(os.path.join(os.getcwd(), 'backend'))

try:
    print("Intentando importar calculate_session_zones...")
    from app.services.zone_calculator import calculate_session_zones
    print("Importación exitosa.")
    
    # Prueba mínima
    dummy_candles = [{"time": 1700000000, "open": 100, "high": 105, "low": 95, "close": 102, "tick_volume": 100}]
    print("Ejecutando calculate_session_zones con 1 vela...")
    result = calculate_session_zones(dummy_candles, 0.25)
    print("Resultado obtenido.")
    
    import json
    print("Intentando serializar a JSON...")
    json.dumps(result)
    print("Serialización exitosa.")

except Exception as e:
    import traceback
    print(f"ERROR: {e}")
    traceback.print_exc()

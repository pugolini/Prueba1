
import asyncio
import json
import logging
from app.services.rithmic_service import rithmic_service

# Configurar logging para ver la salida de rithmic_service
logging.basicConfig(level=logging.INFO)

async def verify_delta():
    import os
    config_path = "backend/rithmic_config.json"
    if not os.path.exists(config_path):
        config_path = "rithmic_config.json"
        
    with open(config_path, "r") as f:
        config = json.load(f)
    
    # Cargar manualmente la configuración en el singleton
    rithmic_service.update_config(config["user"], config["pass"], config.get("system", "Rithmic 01"))
    
    print("\n[VERIFICACIÓN] Iniciando prueba del servicio integrado...")
    
    # 1. Intentar obtener deltas de NQ (que es lo que el usuario opera)
    # El servicio ya traduce NAS100.fs a NQ internamente.
    symbol = "NAS100.fs"
    
    print(f"[VERIFICACIÓN] Llamando a get_historical_deltas para {symbol}...")
    deltas = await rithmic_service.get_historical_deltas(symbol, timeframe_minutes=1)
    
    if deltas:
        print(f"[EXITO] Se han recibido {len(deltas)} velas con Delta.")
        # Mostrar los primeros 5 como muestra
        sample_keys = sorted(deltas.keys())[:5]
        for k in sample_keys:
            print(f"  - Vela {k}: Delta = {deltas[k]}")
    else:
        print("[FALLO] El diccionario de deltas está vacío. Revisa logs de backend_debug.log.")

if __name__ == "__main__":
    # Necesitamos asegurar que el loop de rithmic service esté configurado o usar una instancia directa
    asyncio.run(verify_delta())

import asyncio
import os
import json
import logging
from async_rithmic import RithmicClient
from async_rithmic.enums import DataType

# Configuración de logging para ver todo
logging.basicConfig(level=logging.DEBUG)

async def diagnostic():
    # Cargar credenciales
    config_path = "c:/Programacion/Prueba1/backend/rithmic_config.json"
    with open(config_path, "r") as f:
        config = json.load(f)
    
    user = config["user"]
    password = config["pass"]
    system = "Apex"  # Normalizado
    
    print(f"--- Diagnóstico Rithmic (User: {user}) ---")
    
    client = RithmicClient(
        user=user,
        password=password,
        system_name=system,
        app_name="RTraderPro",
        app_version="1.0",
        url="rprotocol.rithmic.com:443"
    )

    tick_count = 0
    
    async def on_tick(data):
        nonlocal tick_count
        tick_count += 1
        print(f"\n[DIAGNOSTICO] TICK #{tick_count} RECIBIDO:")
        # Intentar ver todos los atributos del objeto data
        try:
            if isinstance(data, dict):
                print(f"Estructura (Dict): {data}")
            else:
                print(f"Clase: {data.__class__.__name__}")
                print(f"Atributos disponibles: {[a for a in dir(data) if not a.startswith('_')]}")
                # Si tiene el método to_dict () o similar
                if hasattr(data, 'to_dict'):
                    print(f"Dictify: {data.to_dict()}")
        except Exception as e:
            print(f"Error inspeccionando: {e}")
        
        if tick_count >= 5:
            print("\nDiagnóstico completado. Cerrando...")
            await client.disconnect()

    client.on_tick += on_tick

    try:
        await client.connect()
        print("Conectado con éxito. Suscribiendo a NQ (CME)...")
        
        # Suscribir a un símbolo activo
        await client.subscribe_to_market_data(
            symbol="NQ",
            exchange="CME",
            data_type=DataType.LAST_TRADE | DataType.BBO
        )
        
        # Esperar a los ticks
        timeout = 30
        elapsed = 0
        while tick_count < 5 and elapsed < timeout:
            await asyncio.sleep(1)
            elapsed += 1
            
        if elapsed >= timeout:
            print("Tiempo de espera agotado sin recibir ticks.")
            
    except Exception as e:
        print(f"Error en diagnóstico: {e}")
    finally:
        await client.disconnect()

if __name__ == "__main__":
    asyncio.run(diagnostic())

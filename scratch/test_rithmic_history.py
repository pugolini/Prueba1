
import asyncio
import logging
import json
from datetime import datetime, timedelta
from async_rithmic.client import RithmicClient
from async_rithmic.enums import DataType, SysInfraType, TimeBarType

# Configuración
logging.basicConfig(level=logging.INFO)

async def test_history():
    import os
    config_path = "backend/rithmic_config.json"
    if not os.path.exists(config_path):
        config_path = "rithmic_config.json" # Fallback
        
    with open(config_path, "r") as f:
        config = json.load(f)
    
    client = RithmicClient(
        user=config["user"],
        password=config["pass"],
        system_name="Apex", 
        app_name="RTraderPro",
        app_version="1.0",
        url="rprotocol.rithmic.com:443"
    )

    
    try:
        logging.info("Conectando a Rithmic...")
        await client.connect(plants=[SysInfraType.TICKER_PLANT, SysInfraType.HISTORY_PLANT])
        
        history = client.plants.get('history')
        if not history:
            logging.error("History plant no disponible")
            return
        
        # Pedir últimos 10 minutos de ticks de NQ (Front Month aprox)
        # NQM6 o similar. Intentemos resolverlo o usar uno directo.
        symbol = "NQM6" # Ajustar si es necesario
        exchange = "CME"
        
        end_time = datetime.utcnow()
        start_time = end_time - timedelta(minutes=10)
        
        logging.info(f"Solicitando ticks para {symbol} desde {start_time}...")
        data = await history.get_historical_tick_data(
            symbol=symbol,
            exchange=exchange,
            start_time=start_time,
            end_time=end_time
        )
        
        if data:
            logging.info(f"Recibidos {len(data)} ticks.")
            first_tick = data[0]
            logging.info(f"Estructura del primer tick: {json.dumps(first_tick, indent=2, default=str)}")
            
            # Verificar si hay agresión
            aggresion_keys = [k for k in first_tick.keys() if 'agressor' in k.lower() or 'side' in k.lower() or 'buy' in k.lower()]
            logging.info(f"Campos potenciales de agresión: {aggresion_keys}")
        else:
            logging.warning("No se recibieron datos. Verifica el símbolo.")
            
    except Exception as e:
        logging.error(f"Error: {e}")
    finally:
        await client.disconnect()

if __name__ == "__main__":
    asyncio.run(test_history())

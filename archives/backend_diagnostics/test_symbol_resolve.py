import asyncio
import os
import json
from async_rithmic import RithmicClient
from async_rithmic.enums import DataType

async def test_symbol_resolve():
    config_path = "c:/Programacion/Prueba1/backend/rithmic_config.json"
    with open(config_path, "r") as f:
        config = json.load(f)
    
    print(f"--- Probando con Contrato Especifico para {config['user']} ---")
    
    client = RithmicClient(
        user=config["user"],
        password=config["pass"],
        system_name="Apex",
        app_name="RTraderPro",
        app_version="1.0",
        url="rprotocol.rithmic.com:443"
    )

    received = False
    
    async def on_tick(data):
        nonlocal received
        received = True
        print(f"!!! TICK RECIBIDO !!!: {data.get('last_trade_price') or data.get('last_price')}")

    async def on_order_book(data):
        print(f"!!! HEATMAP RECIBIDO !!!: {len(getattr(data, 'bids', []))} bids, {len(getattr(data, 'asks', []))} asks")

    client.on_tick += on_tick
    client.on_order_book += on_order_book

    try:
        await client.connect()
        
        # PROBAMOS RESOLVER EL FRONT MONTH
        ticker = client.plants['ticker']
        front_month = await ticker.get_front_month_contract("NQ", "CME")
        print(f"Contrato Front Month resuelto: {front_month}")
        
        target = front_month if front_month else "NQM6" # Fallback a Junio 2026
        
        print(f"Suscribiendo a {target} @ CME...")
        await client.subscribe_to_market_data(
            symbol=target,
            exchange="CME",
            data_type=DataType.LAST_TRADE | DataType.BBO | DataType.ORDER_BOOK
        )
        
        # Esperar 15 segundos a ver si llega algo
        for _ in range(15):
            if received: break
            await asyncio.sleep(1)
            
        if not received:
            print("No se recibieron ticks para el simbolo resuelto.")
            
    except Exception as e:
        print(f"Error en el test: {e}")
    finally:
        await client.disconnect()

if __name__ == "__main__":
    asyncio.run(test_symbol_resolve())

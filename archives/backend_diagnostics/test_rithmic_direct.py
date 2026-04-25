import asyncio
import logging
from async_rithmic.client import RithmicClient
from async_rithmic.enums import DataType

logging.basicConfig(level=logging.DEBUG)

async def on_tick(data):
    print(f"TICK DATA: {data}")

async def on_order_book(data):
    print(f"ORDER BOOK RECEIVED!")

async def main():
    client = RithmicClient(
        user="APEX-466707",
        password="[REDACTED_PASSWORD]",
        system_name="Apex",
        app_name="RTraderPro",
        app_version="1.0",
        url="rprotocol.rithmic.com:443"
    )
    
    # IMPORTANTE: PASSWORD DEBE CARGARSE DE rithmic_config.json
    import json
    with open("rithmic_config.json", "r") as f:
        config = json.load(f)
        client.credentials["password"] = config["pass"]

    client.on_tick += on_tick
    client.on_order_book += on_order_book
    
    print("Conectando...")
    await client.connect()
    print("Conectado. Suscribiendo a NQM6...")
    
    await client.subscribe_to_market_data("NQM6", "CME", DataType.LAST_TRADE | DataType.BBO | DataType.ORDER_BOOK)
    
    print("Esperando 15 segundos por datos...")
    await asyncio.sleep(15)
    
    await client.disconnect()

if __name__ == "__main__":
    asyncio.run(main())

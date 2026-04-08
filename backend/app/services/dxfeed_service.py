import asyncio
import random
import time
import math
from datetime import datetime

class DXFeedMockService:
    def __init__(self):
        self.active_simulations = {}

    async def simulate_orderflow(self, symbol, callback):
        """
        Simula un feed de datos MBO/Level 2 de dxFeed.
        Genera 'Big Trades' agrupados y un 'Order Book' (Heatmap).
        """
        import logging
        logging.info(f"[DXFEED] Iniciando simulación para: {symbol}")
        
        # Generar Bookmap inicial (Liquidez estática)
        base_price = 0
        tick_size = 0.25 # Simulación NQ (Futuros)
        
        while True:
            # Encontrar un precio base si aún no lo tenemos
            import MetaTrader5 as mt5
            tick = mt5.symbol_info_tick(symbol)
            if tick and (tick.last > 0 or tick.bid > 0):
                base_price = tick.last if tick.last > 0 else tick.bid
                logging.info(f"[DXFEED] Precio base encontrado: {base_price} para {symbol}")
                break
            logging.warning(f"[DXFEED] Esperando ticket válido de MT5 para {symbol}...")
            await asyncio.sleep(2)

            if symbol not in self.active_simulations: # Placeholder check
                pass

        last_heatmap_time = 0
        current_server_time = int(time.time()) # Fallback inicial
        
        while True:
            # COMPROBACION: ¿Ya tenemos Rithmic real?
            from app.services.rithmic_service import rithmic_service
            if rithmic_service.user and rithmic_service.password:
                logging.info(f"[DXFEED] Deteniendo simulacion: Credenciales reales detectadas.")
                return

            # Sincronizar con el tiempo del servidor de MT5
            mt_tick = mt5.symbol_info_tick(symbol)
            if mt_tick:
                base_price = mt_tick.last if mt_tick.last > 0 else mt_tick.bid
                current_server_time = mt_tick.time
            else:
                current_server_time = int(time.time())

            # 1. SIMULAR BIG TRADES (Burbujas)
            if random.random() < 0.15: # Un poco más realista
                side = random.choice(['buy', 'sell'])
                size = random.randint(50, 450)
                # Offset reducido para que parezcan ejecuciones reales en el spread
                price_offset = (random.random() - 0.5) * 3 * tick_size
                trade_price = round((base_price + price_offset) / tick_size) * tick_size
                
                big_trade = {
                    "type": "big_trade",
                    "time": current_server_time,
                    "price": trade_price,
                    "size": size,
                    "side": side
                }
                await callback(big_trade)

            # 2. SIMULAR HEATMAP (Liquidez del Book)
            if current_server_time > last_heatmap_time:
                heatmap_rows = []
                for i in range(-50, 50):
                    price = round((base_price + i * tick_size) / tick_size) * tick_size
                    dist = abs(i)
                    if dist > 20 and dist < 25: 
                        size = random.randint(100, 300)
                    elif dist < 5: 
                        size = random.randint(20, 80)
                    else:
                        size = random.randint(5, 30)
                    
                    heatmap_rows.append({"p": price, "s": size})
                
                heatmap_msg = {
                    "type": "heatmap",
                    "time": current_server_time,
                    "data": heatmap_rows
                }
                await callback(heatmap_msg)
                last_heatmap_time = current_server_time

            await asyncio.sleep(0.2) 

dxfeed_mock = DXFeedMockService()

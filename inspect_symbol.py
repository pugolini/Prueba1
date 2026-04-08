import MetaTrader5 as mt5
from datetime import datetime

def inspect_symbol(symbol):
    if not mt5.initialize():
        print("Error al iniciar MT5")
        return

    info = mt5.symbol_info(symbol)
    if info is None:
        print(f"Símbolo {symbol} no encontrado.")
        return

    print(f"--- Info para {symbol} ---")
    print(f"Trade Mode: {info.trade_mode}")
    print(f"Time: {datetime.fromtimestamp(info.time)}")
    
    # Intentar obtener ticks recientes
    tick = mt5.symbol_info_tick(symbol)
    if tick:
        print(f"Último tick: {datetime.fromtimestamp(tick.time)}")
        
    # Investigar sesiones (aunque no siempre son accesibles directamente via python API de forma estructurada)
    # Algunas propiedades interesantes:
    # info.session_deals, info.session_buy_orders, etc.
    
    mt5.shutdown()

if __name__ == "__main__":
    inspect_symbol("NAS100.pro")
    inspect_symbol("BTCUSD.pro") # BTC debería estar abierto hoy

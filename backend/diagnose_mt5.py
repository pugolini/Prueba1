import MetaTrader5 as mt5
import logging

logging.basicConfig(level=logging.INFO)

def diagnose():
    path = r"C:\Program Files\Axi MetaTrader 5 Terminal\terminal64.exe"
    if not mt5.initialize(path=path):
        print(f"Error inicialización: {mt5.last_error()}")
        return

    print("--- CONEXIÓN ---")
    print(f"Versión MT5: {mt5.version()}")
    print(f"Terminal Info: {mt5.terminal_info()._asdict() if mt5.terminal_info() else 'None'}")
    
    symbol = "NAS100.fs"
    print(f"\n--- SÍMBOLO: {symbol} ---")
    selected = mt5.symbol_select(symbol, True)
    print(f"Seleccionado en Market Watch: {selected}")
    
    info = mt5.symbol_info(symbol)
    if info:
        print(f"Info Símbolo: Trade Mode={getattr(info, 'trade_mode', 'N/A')}, Digits={getattr(info, 'digits', 'N/A')}")
        print(f"Volume: Min={getattr(info, 'volume_min', 'N/A')}, Step={getattr(info, 'volume_step', 'N/A')}, Max={getattr(info, 'volume_max', 'N/A')}")
    else:
        print(f"Error al obtener info de {symbol}: {mt5.last_error()}")

    tick = mt5.symbol_info_tick(symbol)
    if tick:
        print(f"Último Tick: bid={tick.bid}, ask={tick.ask}, time={tick.time}")
    else:
        print(f"Error al obtener tick de {symbol}: {mt5.last_error()}")

    print("\n--- PRUEBA DE ORDEN (A MERCADO) ---")
    # Intentamos una orden de compra pequeña (BUY 0.01)
    # ATENCIÓN: Esto es una prueba real.
    request = {
        "action": mt5.TRADE_ACTION_DEAL,
        "symbol": symbol,
        "volume": 0.01,
        "type": mt5.ORDER_TYPE_BUY,
        "price": mt5.symbol_info_tick(symbol).ask if mt5.symbol_info_tick(symbol) else 0,
        "magic": 123456,
        "comment": "Diagnose Test",
        "type_time": mt5.ORDER_TIME_GTC,
        "type_filling": mt5.ORDER_FILLING_IOC,
    }
    
    if request["price"] > 0:
        result = mt5.order_send(request)
        if result:
            print(f"Resultado Orden: retcode={result.retcode}, comment={result.comment}, order={result.order}")
            if result.retcode != mt5.TRADE_RETCODE_DONE:
                print(f"ERROR DETALLADO: {mt5.last_error()}")
        else:
            print("Error: No se recibió respuesta de order_send")
    else:
        print("Error: Precio inválido para la orden")

    mt5.shutdown()

if __name__ == "__main__":
    diagnose()

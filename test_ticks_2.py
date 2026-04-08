import MetaTrader5 as mt5
from datetime import datetime, timedelta

if not mt5.initialize():
    print("Error init")
    quit()

symbol = "BTCUSD.pro"
mt5.symbol_select(symbol, True)

# Primero sincronizar con la última vela para estar seguros de que hay data
rates = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M1, 0, 1)
if rates is not None and len(rates) > 0:
    last_candle_time = datetime.fromtimestamp(rates[0][0])
    print(f"Last candle time: {last_candle_time}")
    
    # Probar copy_ticks_from desde el inicio de la última vela
    ticks = mt5.copy_ticks_from(symbol, last_candle_time, 100, mt5.COPY_TICKS_ALL)
    if ticks is not None:
        print(f"Ticks count: {len(ticks)}")
        if len(ticks) > 0:
            print(f"First tick time: {datetime.fromtimestamp(ticks[0]['time'])}")
            print(f"Last tick time: {datetime.fromtimestamp(ticks[-1]['time'])}")
    else:
        print("No ticks from last candle time")
else:
    print("No rates found")

mt5.shutdown()

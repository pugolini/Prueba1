import MetaTrader5 as mt5
from datetime import datetime, timedelta

if not mt5.initialize():
    print("Error init")
    quit()

symbol = "BTCUSD.pro"
if not mt5.symbol_select(symbol, True):
    symbol = "BTCUSD" # Fallback
    mt5.symbol_select(symbol, True)

# 1. Obtener última vela
rates = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M1, 0, 1)
if rates is None or len(rates) == 0:
    print("No hay velas")
    quit()

last_candle_time = rates[0][0]
anchor = datetime.fromtimestamp(last_candle_time)
print(f"Anchor Time (Fin de la última vela): {anchor}")

# 2. Probar copy_ticks_from con count positivo
# ¿Va hacia el futuro o hacia el pasado?
ticks_fwd = mt5.copy_ticks_from(symbol, anchor, 10, mt5.COPY_TICKS_ALL)
if ticks_fwd is not None and len(ticks_fwd) > 0:
    print(f"\ncopy_ticks_from(anchor, 10):")
    print(f"  First tick: {datetime.fromtimestamp(ticks_fwd[0]['time'])}")
    print(f"  Last tick:  {datetime.fromtimestamp(ticks_fwd[-1]['time'])}")
    if ticks_fwd[0]['time'] >= last_candle_time:
        print("  >> RESULTADO: VA HACIA EL FUTURO.")
    else:
        print("  >> RESULTADO: VA HACIA EL PASADO.")

# 3. Probar copy_ticks_range para ir al pasado
# Queremos los ticks entre (anchor - 1 hora) y anchor
start_range = anchor - timedelta(hours=1)
ticks_range = mt5.copy_ticks_range(symbol, start_range, anchor, mt5.COPY_TICKS_ALL)
if ticks_range is not None:
    print(f"\ncopy_ticks_range(anchor - 1h, anchor):")
    print(f"  Count: {len(ticks_range)}")
    if len(ticks_range) > 0:
        print(f"  First: {datetime.fromtimestamp(ticks_range[0]['time'])}")
        print(f"  Last:  {datetime.fromtimestamp(ticks_range[-1]['time'])}")

mt5.shutdown()

import MetaTrader5 as mt5
from datetime import datetime, timedelta

if not mt5.initialize():
    print("Error init")
    quit()

symbol = "BTCUSD.pro"
mt5.symbol_select(symbol, True)

now = datetime.now()
count = 10
ticks = mt5.copy_ticks_from(symbol, now, count, mt5.COPY_TICKS_ALL)

if ticks is not None:
    print(f"Ticks count: {len(ticks)}")
    print(f"First tick time: {datetime.fromtimestamp(ticks[0]['time'])}")
    print(f"Last tick time: {datetime.fromtimestamp(ticks[-1]['time'])}")
else:
    print("No ticks")

mt5.shutdown()

import MetaTrader5 as mt5
import pandas as pd

if not mt5.initialize():
    print(f"FAILED to initialize MT5: {mt5.last_error()}")
    exit()

print("MT5 Initialized.")
symbol = "NAS100.pro"

# Select symbol
if not mt5.symbol_select(symbol, True):
    print(f"FAILED to select {symbol}: {mt5.last_error()}")
    mt5.shutdown()
    exit()

print(f"Symbol {symbol} selected.")

# Try to get rates
# Use 100 bars for testing
rates = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M1, 0, 100)
if rates is None:
    print(f"FAILED to fetch rates: {mt5.last_error()}")
else:
    print(f"SUCCESS! Fetched {len(rates)} bars.")
    df = pd.DataFrame(rates)
    print(df.head())

mt5.shutdown()

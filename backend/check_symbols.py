import MetaTrader5 as mt5
import os
from dotenv import load_dotenv

load_dotenv()

if not mt5.initialize():
    print("initialize() failed")
    quit()

symbols = mt5.symbols_get()
print(f"Total symbols found: {len(symbols)}")

interesting_patterns = ["NAS", "USTEC", "XAU", "BTC", "EURUSD"]
for s in symbols:
    if any(p in s.name for p in interesting_patterns):
        print(f"Found: {s.name}")

mt5.shutdown()

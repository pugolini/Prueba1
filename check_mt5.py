import MetaTrader5 as mt5
import pandas as pd

if not mt5.initialize():
    print(f"MT5 failed to initialize: {mt5.last_error()}")
else:
    print("MT5 initialized successfully.")
    
    # Check symbols
    symbols = mt5.symbols_get()
    print(f"Total symbols found: {len(symbols)}")
    
    target_symbols = ["NAS100", "USTEC", "US Tech 100", "XAUUSD", "GOLD"]
    for s in target_symbols:
        info = mt5.symbol_info(s)
        if info:
            print(f"Symbol found: {s} (Selectable as {info.name})")
        else:
            print(f"Symbol NOT found: {s}")
            
    # Try fetching history for NAS100
    rates = mt5.copy_rates_from_pos("NAS100", mt5.TIMEFRAME_M1, 0, 10)
    if rates is not None:
        print(f"History fetch success! {len(rates)} bars found.")
    else:
        print(f"History fetch failed for NAS100: {mt5.last_error()}")

    mt5.shutdown()

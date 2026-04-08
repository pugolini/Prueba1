import MetaTrader5 as mt5

if not mt5.initialize():
    print(f"MT5 failed to initialize")
else:
    symbols = mt5.symbols_get()
    print("Listing all symbols found:")
    for s in symbols:
        print(f"- {s.name}")
    mt5.shutdown()

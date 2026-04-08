import MetaTrader5 as mt5
if mt5.initialize():
    symbols = mt5.symbols_get()
    for s in symbols:
        print(s.name)
    mt5.shutdown()

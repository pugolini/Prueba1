import MetaTrader5 as mt5

if mt5.initialize():
    symbol = "NAS100.pro"
    rates = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M1, 0, 100)
    if rates is not None:
        print(f"First 5 times: {[int(r[0]) for r in rates[:5]]}")
        print(f"Last 5 times: {[int(r[0]) for r in rates[-5:]]}")
    mt5.shutdown()

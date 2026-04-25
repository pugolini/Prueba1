
import sys
import os
import pandas as pd
from datetime import datetime, timezone
import MetaTrader5 as mt5

# Mocking calculate_volume_profile for testing counts
def calculate_volume_profile(candles, tick_size, return_histogram=False):
    return {"poc": 0, "vah": 0, "val": 0, "histogram": [1]*len(candles)}

def debug_zones(symbol):
    if not mt5.initialize():
        print("MT5 Init failed")
        return

    # Fetch 2880 candles
    bars = mt5.copy_rates_from_pos(symbol, mt5.TIMEFRAME_M1, 0, 2880)
    if bars is None:
        print("Fetch failed")
        return
        
    candles = [{"time": int(b[0]), "open": b[1], "high": b[2], "low": b[3], "close": b[4], "tick_volume": int(b[5])} for b in bars]
    
    # Logic from zone_calculator
    now_utc = datetime.now(timezone.utc).timestamp()
    latest_broker_ts = candles[-1].get("time", 0)
    diff = latest_broker_ts - now_utc
    if abs(diff) > 3600 * 24:
        broker_offset_seconds = 7200 
    else:
        broker_offset_seconds = round(diff / 3600) * 3600
        
    df_all = pd.DataFrame(candles)
    df_all['time_utc'] = df_all['time'] - broker_offset_seconds
    df_all['dt_ny'] = pd.to_datetime(df_all['time_utc'], unit='s', utc=True).dt.tz_convert('America/New_York')
    
    latest_ny = df_all['dt_ny'].iloc[-1]
    
    mask_on = (
        ((df_all['dt_ny'].dt.hour >= 18) & (df_all['dt_ny'].dt.date < latest_ny.date())) |
        ((df_all['dt_ny'].dt.hour < 9) & (df_all['dt_ny'].dt.date == latest_ny.date())) |
        ((df_all['dt_ny'].dt.hour == 9) & (df_all['dt_ny'].dt.minute < 30) & (df_all['dt_ny'].dt.date == latest_ny.date()))
    )
    on_df = df_all[mask_on]
    
    mask_rth = (
        ((df_all['dt_ny'].dt.hour == 9) & (df_all['dt_ny'].dt.minute >= 30) & (df_all['dt_ny'].dt.date == latest_ny.date())) |
        ((df_all['dt_ny'].dt.hour > 9) & (df_all['dt_ny'].dt.hour < 16) & (df_all['dt_ny'].dt.date == latest_ny.date()))
    )
    rth_df = df_all[mask_rth]
    
    print(f"Latest NY: {latest_ny}")
    print(f"ON Candles: {len(on_df)}")
    print(f"RTH Candles: {len(rth_df)}")
    
    if len(on_df) == 0:
        print("Sample of dt_ny:")
        print(df_all['dt_ny'].tail(10))

debug_zones("NQ.fs") # Try NQ variants
mt5.shutdown()

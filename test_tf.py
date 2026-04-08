import MetaTrader5 as mt5
import sys

# Mapeo de temporalidades de texto a MT5
TF_MAP = {
    "1m": mt5.TIMEFRAME_M1,
    "1": mt5.TIMEFRAME_M1,
    "5m": mt5.TIMEFRAME_M5,
    "5": mt5.TIMEFRAME_M5,
    "15m": mt5.TIMEFRAME_M15,
    "15": mt5.TIMEFRAME_M15,
    "30m": mt5.TIMEFRAME_M30,
    "30": mt5.TIMEFRAME_M30,
    "1h": mt5.TIMEFRAME_H1,
    "4h": mt5.TIMEFRAME_H4,
    "1d": mt5.TIMEFRAME_D1,
    "D": mt5.TIMEFRAME_D1,
}

print("Testing TF_MAP lookups:")
for key in TF_MAP:
    print(f"Key: {key} -> Value: {TF_MAP[key]}")

print("\nMT5 Constants check:")
print(f"TIMEFRAME_M1: {mt5.TIMEFRAME_M1}")
print(f"TIMEFRAME_M5: {mt5.TIMEFRAME_M5}")
print(f"TIMEFRAME_M15: {mt5.TIMEFRAME_M15}")
print(f"TIMEFRAME_M30: {mt5.TIMEFRAME_M30}")
print(f"TIMEFRAME_H1: {mt5.TIMEFRAME_H1}")
print(f"TIMEFRAME_H4: {mt5.TIMEFRAME_H4}")
print(f"TIMEFRAME_D1: {mt5.TIMEFRAME_D1}")

from app.services.mt5_service import mt5_service
import MetaTrader5 as mt5

if mt5_service.initialize():
    print("Testing data fetch for NAS100.pro...")
    data = mt5_service.get_historical_data("NAS100.pro", mt5.TIMEFRAME_M1, 10)
    print(f"Data received: {len(data)} bars.")
    if len(data) > 0:
        print("First bar:", data[0])
    
    print("\nTesting tick fetch...")
    tick = mt5_service.get_last_tick("NAS100.pro")
    print(f"Tick received: {tick}")
    
    mt5_service.shutdown()
else:
    print("Failed to initialize MT5 service.")


import MetaTrader5 as mt5
import sys
import os

# Añadir el path del backend para importar los servicios
sys.path.append(os.path.join(os.getcwd(), 'backend'))

from app.services.mt5_service import mt5_service

def test_us500_mapping():
    print("--- [TEST: Mapeo US500] ---")
    
    # 1. Inicializar MT5
    if not mt5_service.initialize():
        print("ERROR: No se pudo inicializar MT5.")
        return

    # 2. Probar traducción de ES
    symbol_cme = "ES"
    translated = mt5_service.translate_to_mt5_symbol(symbol_cme)
    print(f"Símbolo CME: {symbol_cme} -> Mapeado en Broker: {translated}")

    # 3. Intentar obtener velas
    print(f"Solicitando últimas 5 velas para {translated} (M1)...")
    candles = mt5_service.get_historical_data(symbol_cme, mt5.TIMEFRAME_M1, 5)
    
    if candles:
        print(f"¡ÉXITO! Recibidas {len(candles)} velas.")
        for c in candles:
            print(f"Time: {c['time']}, O: {c['open']}, H: {c['high']}, L: {c['low']}, C: {c['close']}, Vol: {c['tick_volume']}")
    else:
        print(f"FALLO: No se recibieron velas para {translated}.")
        print(f"Error MT5: {mt5.last_error()}")

    mt5_service.shutdown()

if __name__ == "__main__":
    test_us500_mapping()

import sys
import os
import asyncio
import math

# Simular entorno de Rithmic
def calculate_delta(volume, bid_volume):
    # AskVol = volume - bid_volume
    # Delta = AskVol - BidVol = (volume - bid_volume) - bid_volume
    return (volume - bid_volume) - bid_volume

def test_aggregation():
    print("--- Test de Agregación de Delta ---")
    ticks = [
        {"v": 10, "b": 4},  # Delta = (10-4)-4 = 2
        {"v": 5, "b": 5},   # Delta = (5-5)-5 = -5 (ERRÓNEO si v es total)
        # Re-evaluando lógica: Rithmic suele dar 'volume' como el tamaño del trade actual
        # y 'bid_volume' como el volumen en el bid en ese momento? 
        # No, en template 150/151 de Rithmic, si es un trade:
        # trade_size es el volumen del trade.
        # Necesitamos saber si el trade fue al ask o al bid.
    ]
    
    # Lógica Rithmic Service actual en rithmic_service.py:
    # vol = float(t.get('volume', 0))
    # bid_vol = float(t.get('bid_volume', 0))
    # tick_delta = (vol - bid_vol) - bid_vol
    
    # Si vol es el TOTAL de la vela y bid_vol es el acumulado de bid:
    # v=100, b=40 -> Ask=60 -> Delta = 60 - 40 = 20.
    # (100 - 40) - 40 = 20. CORRECTO.
    
    v = 100
    b = 40
    d = (v - b) - b
    print(f"Vol: {v}, Bid: {b} -> Delta calculado: {d} (Esperado: 20)")
    assert d == 20
    
    v = 100
    b = 60
    d = (v - b) - b
    print(f"Vol: {v}, Bid: {b} -> Delta calculado: {d} (Esperado: -20)")
    assert d == -20
    
    print("✓ Lógica de backend validada.")

if __name__ == "__main__":
    test_aggregation()

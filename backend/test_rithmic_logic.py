import asyncio
import logging
from datetime import datetime
from unittest.mock import MagicMock

# Importar el servicio
import sys
sys.path.append("c:/Programacion/Prueba1/backend")
from app.services.rithmic_service import rithmic_service

async def test_logic():
    print("--- Test de Lógica RithmicService ---")
    
    # Mock de un callback de WebSocket
    async def mock_callback(payload):
        print(f"[TEST] Callback recibido: {payload}")

    # Configurar el servicio con un suscriptor
    symbol = "NQ"
    rithmic_service._subscribers[symbol] = [mock_callback]
    rithmic_service._subscribed_symbols.add(symbol)
    
    print(f"Suscriptores configurados para: {list(rithmic_service._subscribers.keys())}")

    # SIMULACIÓN 1: Tick con símbolo presente (como diccionario)
    print("\nEscenario 1: Tick con símbolo en el diccionario")
    tick_data_1 = {
        'symbol': 'NQ',
        'last_trade_price': 18000.50,
        'last_trade_size': 10
    }
    await rithmic_service._on_tick_received(tick_data_1)

    # SIMULACIÓN 2: Tick sin símbolo (Inferencia)
    print("\nEscenario 2: Tick SIN símbolo (debería inferirse NQ)")
    tick_data_2 = {
        'last_trade_price': 18001.25,
        'last_trade_size': 5
    }
    await rithmic_service._on_tick_received(tick_data_2)

    # ESCENARIO 4: Múltiples activos (NQ y ES)
    print("\nEscenario 4: Múltiples activos registrados")
    symbol_nq = "NQ"
    symbol_es = "ES"
    
    # Simular WebSockets para cada uno
    async def cb_nq(payload): print(f"[TEST NQ] Recibido: {payload['price']}")
    async def cb_es(payload): print(f"[TEST ES] Recibido: {payload['price']}")
    
    rithmic_service._subscribers = {
        symbol_nq: [cb_nq],
        symbol_es: [cb_es]
    }
    rithmic_service._subscribed_symbols = {symbol_nq, symbol_es}

    # Tick para NQ
    print(">> Enviando tick para NQ")
    await rithmic_service._on_tick_received({'symbol': 'NQ', 'last_trade_price': 18050.0})

    # Tick para ES
    print(">> Enviando tick para ES")
    await rithmic_service._on_tick_received({'symbol': 'ES', 'last_trade_price': 5250.75})

    # ESCENARIO 6: Heatmap / OrderBook
    print("\nEscenario 6: Simulación de OrderBook (Heatmap)")
    
    # Mock de un mensaje Protobuf para OrderBook
    order_book_mock = MagicMock()
    
    # Simulamos lo que MessageToDict devolvería para este mock
    # En el test, mockearemos MessageToDict para que devuelva nuestra estructura controlada
    from app.services import rithmic_service as rs_module
    original_m2d = rs_module.MessageToDict
    rs_module.MessageToDict = MagicMock(return_value={
        'symbol': 'NQ',
        'bids': [{'p': 18000.0, 's': 10}, {'p': 17999.75, 's': 25}],
        'asks': [{'p': 18000.25, 's': 15}]
    })

    try:
        # Volvemos a poner como único activo NQ para probar la inferencia también en Heatmap
        rithmic_service._subscribers = { "NQ": [mock_callback] }
        rithmic_service._subscribed_symbols = { "NQ" }
        
        await rithmic_service._on_order_book_received(order_book_mock)
    finally:
        # Restaurar la función original
        rs_module.MessageToDict = original_m2d

if __name__ == "__main__":
    asyncio.run(test_logic())

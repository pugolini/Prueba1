"""
Test para verificar que el WebSocket del backend envía heartbeats con precio actualizado para BTCUSD
"""
import websocket
import time
import json
import sys

# Configuración
WS_URL = "ws://localhost:8001/ws/prices/BTCUSD"
TEST_DURATION_SECONDS = 5
EXPECTED_HEARTBEAT_INTERVAL = 1.0

# Contadores y resultados
heartbeats_received = 0
tick_bursts_received = 0
errors = []
heartbeat_times = []
valid_prices = True

def on_message(ws, message):
    global heartbeats_received, tick_bursts_received, valid_prices, heartbeat_times

    try:
        data = json.loads(message)
        msg_type = data.get('type')

        if msg_type == 'heartbeat':
            heartbeats_received += 1
            heartbeat_times.append(time.time())

            # Verificar que los precios son válidos
            bid = data.get('bid', 0)
            ask = data.get('ask', 0)
            last = data.get('last', 0)

            print(f"[HEARTBEAT #{heartbeats_received}] bid={bid}, ask={ask}, last={last}")

            # BTCUSD puede tener last=0, pero bid y ask deben ser > 0
            if bid <= 0:
                errors.append("Heartbeat con bid <= 0")
                valid_prices = False
            if ask <= 0:
                errors.append("Heartbeat con ask <= 0")
                valid_prices = False

            # last puede ser 0 en algunos brokers, si es 0 debe usar bid
            if last < 0:
                errors.append("Heartbeat con last negativo")
                valid_prices = False

        elif msg_type == 'tick_burst':
            tick_bursts_received += 1
            ticks = data.get('data', [])
            print(f"[TICK_BURST #{tick_bursts_received}] {len(ticks)} ticks recibidos")

        elif msg_type == 'tick':
            print(f"[TICK] {data}")

    except json.JSONDecodeError as e:
        errors.append(f"Error parsing JSON: {e}")
    except Exception as e:
        errors.append(f"Error processing message: {e}")

def on_error(ws, error):
    errors.append(f"WebSocket error: {error}")
    print(f"[ERROR] {error}")

def on_close(ws, close_status_code, close_msg):
    print("### WebSocket closed ###")

def on_open(ws):
    print("### WebSocket connection opened ###")
    print(f"Testing: {WS_URL}")
    print(f"Duration: {TEST_DURATION_SECONDS} seconds")

def run_test():
    global heartbeats_received, tick_bursts_received, errors

    # Enable trace for debugging
    websocket.enableTrace(False)

    ws = websocket.WebSocketApp(
        WS_URL,
        on_message=on_message,
        on_error=on_error,
        on_close=on_close,
        on_open=on_open
    )

    # Run in a separate thread so we can timeout
    import threading
    ws_thread = threading.Thread(target=ws.run_forever)
    ws_thread.daemon = True
    ws_thread.start()

    # Wait for test duration
    start_time = time.time()
    while (time.time() - start_time) < TEST_DURATION_SECONDS:
        time.sleep(0.1)

    ws.close()

    # Give it a moment to process final messages
    time.sleep(0.5)

    # Evaluación de resultados
    print("\n" + "=" * 60)
    print("RESULTADOS DEL TEST")
    print("=" * 60)
    print(f"Heartbeats recibidos: {heartbeats_received}")
    print(f"Tick bursts recibidos: {tick_bursts_received}")
    print(f"Errores: {len(errors)}")

    if errors:
        print("\nErrores encontrados:")
        for err in errors:
            print(f"  - {err}")

    # Verificaciones
    passed = True

    # 1. Debe recibir al menos 3 heartbeats en 5 segundos
    if heartbeats_received < 3:
        print(f"\n[FAIL] Se esperaban al menos 3 heartbeats, se recibieron {heartbeats_received}")
        passed = False
    else:
        print(f"\n[PASS] Heartbeats recibidos >= 3")

    # 2. Los precios deben ser válidos
    if not valid_prices:
        print("[FAIL] Los precios no son válidos")
        passed = False
    else:
        print("[PASS] Precios válidos (bid > 0, ask > 0)")

    # 3. No debe haber errores críticos
    if len(errors) > 0:
        print(f"[FAIL] Se encontraron {len(errors)} errores")
        passed = False
    else:
        print("[PASS] Sin errores")

    # 4. Verificar intervalo de heartbeats (~1 segundo)
    if len(heartbeat_times) >= 2:
        intervals = []
        for i in range(1, len(heartbeat_times)):
            intervals.append(heartbeat_times[i] - heartbeat_times[i-1])
        avg_interval = sum(intervals) / len(intervals)
        print(f"\nIntervalo promedio de heartbeats: {avg_interval:.2f}s (esperado ~{EXPECTED_HEARTBEAT_INTERVAL}s)")

        if 0.8 <= avg_interval <= 1.5:
            print("[PASS] Intervalo de heartbeats correcto")
        else:
            print("[WARN] Intervalo de heartbeats fuera del rango esperado")

    print("=" * 60)

    if passed:
        print("\n*** TEST PASSED ***")
        return 0
    else:
        print("\n*** TEST FAILED ***")
        return 1

if __name__ == "__main__":
    print("=" * 60)
    print("Test de WebSocket - BTCUSD Price Stream")
    print("=" * 60)

    try:
        sys.exit(run_test())
    except KeyboardInterrupt:
        print("\nTest interrupted by user")
        sys.exit(1)
    except Exception as e:
        print(f"\nTest failed with exception: {e}")
        sys.exit(1)

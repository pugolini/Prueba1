from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException, Request
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from app.services.mt5_service import mt5_service
from app.services.mt4_service import mt4_service
from app.services.dxfeed_service import dxfeed_mock
from app.services.rithmic_service import rithmic_service
import MetaTrader5 as mt5
import asyncio
import json
import logging
import time
import random
from datetime import datetime

# Configuración de logging global con salida a archivo (FORCED FLUSH)
logging.basicConfig(
    level=logging.INFO, # Bajamos el global a INFO para evitar el dump binario de websockets
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("backend_debug.log", mode='a', delay=False),
        logging.StreamHandler()
    ],
    force=True
)

# Silenciamos especificamente websockets para no ver el binario crudo
logging.getLogger('websockets').setLevel(logging.INFO)
# Mantenemos Rithmic en DEBUG para ver que pasa exactamente
logging.getLogger('app.services.rithmic_service').setLevel(logging.DEBUG)

from contextlib import asynccontextmanager
import traceback

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Ya no inicializamos MT5 aquí para evitar bloqueos en el arranque (lifespan hang).
    # La conexión se realizará bajo demanda en los servicios correspondientes.
    yield
    # Cierre: Desconexión limpia si estaba activo
    if mt5_service.initialized:
        mt5_service.shutdown()


app = FastAPI(title="Pugobot Trading API", lifespan=lifespan)

@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logging.error(f"GLOBAL ERROR: {exc}\n{traceback.format_exc()}")
    return JSONResponse(
        status_code=500,
        content={"error": str(exc), "traceback": traceback.format_exc()},
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "*",
            "Access-Control-Allow-Headers": "*",
        }
    )

@app.get("/api/ping")
async def ping():
    return {"status": "ok", "time": time.time()}


# CORS para el frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mapeo de temporalidades de texto a MT5 (Estándar Global)
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
    "1H": mt5.TIMEFRAME_H1,
    "4h": mt5.TIMEFRAME_H4,
    "4H": mt5.TIMEFRAME_H4,
    "1d": mt5.TIMEFRAME_D1,
    "D": mt5.TIMEFRAME_D1,
}

# resolve_symbol eliminada en favor de mt5_service.translate_to_mt5_symbol (Centralizado)

@app.get("/api/all_symbols")
async def list_all_symbols():
    """Endpoint de diagnóstico para listar todos los símbolos del broker."""
    symbols = mt5.symbols_get()
    if not symbols: return []
    return [s.name for s in symbols]

@app.get("/api/session-zones/{symbol}")
async def get_session_zones(symbol: str, timeframe: str = "1m"):
    """Calcula zonas institucionales: POC/VAH/VAL día anterior, IB, Overnight, Gap, Bias."""
    from app.services.zone_calculator import calculate_session_zones
    
    target = mt5_service.translate_to_mt5_symbol(symbol)
    if not target:
        return {"error": f"Symbol {symbol} not found"}
    
    # Obtener velas de 1m de los últimos días (~5000 velas para cubrir sesiones previas)
    count = 5000
    
    if target == "DEMO":
        from app.services.virtual_feed import virtual_feed
        candles = virtual_feed.get_history(count)
    else:
        mt5.symbol_select(target, True)
        tf = mt5.TIMEFRAME_M1
        # Usar el servicio normalizado para asegurar UTC en el cálculo de zonas
        candles = mt5_service.get_historical_data(target, tf, count)
        if not candles:
            logging.error(f"[Zones] Error: No se pudieron obtener velas para {target}")
            return {"error": "Failed to fetch history"}
    
    info = mt5.symbol_info(target)
    tick_size = 0.25
    if info and info.trade_tick_size > 0:
        tick_size = info.trade_tick_size
    
    zones = calculate_session_zones(candles, tick_size)
    return zones


@app.get("/status/{symbol}")
@app.get("/api/status/{symbol}")
async def get_status(symbol: str):
    try:
        target = mt5_service.translate_to_mt5_symbol(symbol)
        if not target:
            raise ValueError("Symbol mapping failed")
            
        if target == "DEMO":
            return {
                "status": "connected",
                "symbol": "DEMO",
                "market_open": True,
                "mt5_connected": True,
                "tick_size": 0.25,
                "tick_value": 5.0,
                "contract_size": 1.0,
                "profit_currency": "USD"
            }
        
        info = mt5.symbol_info(target)
        if not info:
            # Safe Fallback: Símbolo no cargado aún en el broker
            return {
                "status": "connected",
                "symbol": target,
                "market_open": True,
                "mt5_connected": True,
                "tick_size": 0.25,
                "tick_value": 1.0,
                "contract_size": 1.0,
                "currency": "USD",
                "profit_currency": "USD"
            }

        return {
            "status": "connected",
            "symbol": target,
            "market_open": info.visible,
            "mt5_connected": True,
            "tick_size": info.trade_tick_size,
            "tick_value": info.trade_tick_value,
            "contract_size": info.trade_contract_size,
            "currency": info.currency_base,
            "profit_currency": info.currency_profit
        }
    except Exception as e:
        logging.error(f"Error silencioso en get_status para {symbol}: {e}")
        # Retorno de emergencia para evitar 500
        return {
            "status": "partial",
            "symbol": symbol,
            "market_open": True,
            "mt5_connected": False,
            "tick_size": 0.25,
            "tick_value": 1.0,
            "contract_size": 1.0,
            "currency": "USD"
        }

@app.post("/api/rithmic/config")
async def set_rithmic_config(config: dict):
    """Sincroniza las credenciales de Rithmic desde el frontend."""
    rithmic_service.update_config(
        config.get("user", ""),
        config.get("pass", ""),
        config.get("system", "Rithmic 01")
    )
    # Cortamos la conexión actual si existiera para forzar el reinicio con nuevas credenciales
    await rithmic_service.disconnect()
    
    return {"status": "success"}

@app.get("/api/rithmic/historical-delta/{symbol}")
async def get_rithmic_historical_delta(symbol: str, timeframe: str = "1m", since: int = 0):
    """
    [DEPRECATED] Usar /api/rithmic/historical-data/{symbol} para nueva arquitectura dual.
    Obtiene el Delta exacto por vela desde Rithmic (History Plant).
    """
    try:
        import re
        match = re.search(r'(\d+)', timeframe)
        tf_mins = int(match.group(1)) if match else 1
        
        deltas = await rithmic_service.get_historical_deltas(symbol, tf_mins, since)
        logging.info(f"[API] Exportando {len(deltas)} puntos de Delta historico para {symbol} (TF: {tf_mins}m, Since TS: {since})")
        return deltas
    except Exception as e:
        logging.error(f"Error en endpoint historical-delta: {e}")
        return {}

@app.get("/api/rithmic/historical-data/{symbol}")
async def get_rithmic_historical_data(symbol: str, timeframe: str = "1m", since: int = 0):
    """
    Arquitectura de Doble Capa para Rithmic:
    
    Retorna:
    {
      "bars": { timestamp: { open, high, low, close, volume, netDelta } },
      "footprintMaps": { timestamp: { price_str: { bid, ask } } }
    }
    
    - bars: Cubre todo el rango desde since (máx 90 días). Velas agregadas, eficientes.
    - footprintMaps: SOLO últimas 48h. Mapas de precios reales para Order Flow.
    """
    try:
        import re
        match = re.search(r'(\d+)', timeframe)
        tf_mins = int(match.group(1)) if match else 1
        
        result = await rithmic_service.get_historical_data_dual(symbol, tf_mins, since)
        logging.info(
            f"[API-DUAL] {symbol}: {len(result.get('bars', {}))} barras, "
            f"{len(result.get('footprintMaps', {}))} footprint maps"
        )
        return result
    except Exception as e:
        logging.error(f"Error en endpoint historical-data: {e}")
        return {"bars": {}, "footprintMaps": {}}

@app.post("/api/order")
async def place_order(order_data: dict):
    platform = order_data.get("platform", "MT5")
    if platform == "MT4":
        result = await mt4_service.send_order(
            symbol=order_data["symbol"],
            order_type=order_data["type"],
            lot=order_data["lot"],
            price=order_data.get("price", 0),
            sl=order_data.get("sl", 0),
            tp=order_data.get("tp", 0)
        )
    else:
        result = await mt5_service.send_order(
            symbol=order_data["symbol"],
            order_type=order_data["type"],
            lot=order_data["lot"],
            price=order_data.get("price", 0),
            sl=order_data.get("sl", 0),
            tp=order_data.get("tp", 0)
        )
    return result

@app.get("/api/trading/status/{symbol}")
async def get_trading_status(symbol: str, platform: str = "MT5"):
    """Devuelve posiciones, órdenes y estado de cuenta."""
    if platform == "MT4":
        status = await mt4_service.get_status(symbol)
        if "error" in status:
            # Fallback simple si el EA no responde
            return {
                "positions": [],
                "orders": [],
                "account": {"balance": 0, "equity": 0, "margin_free": 0, "profit": 0, "leverage": 1, "currency": "USD"}
            }
        return status
    
    positions = mt5_service.get_positions(symbol)
    orders = mt5_service.get_orders(symbol)
    account = mt5_service.get_account_info()
    return {
        "positions": positions,
        "orders": orders,
        "account": account
    }

@app.get("/api/trading/history/{symbol}")
async def get_trading_history(symbol: str, days: int = 7):
    """Devuelve el historial de operaciones cerradas."""
    history = mt5_service.get_history(symbol, days)
    return history

@app.get("/api/watchlist")
async def get_watchlist_prices(symbols: str):
    """Obtiene precios actuales para una lista de símbolos (separados por coma)."""
    sym_list = symbols.split(',')
    results = {}
    for s in sym_list:
        target = mt5_service.translate_to_mt5_symbol(s)
        if target:
            tick = mt5.symbol_info_tick(target)
            if tick:
                results[s] = {
                    "price": tick.last if tick.last > 0 else (tick.bid if tick.bid > 0 else tick.ask),
                    "bid": tick.bid,
                    "ask": tick.ask,
                    "symbol_real": target
                }
            else:
                results[s] = {"error": "No tick data"}
        else:
            results[s] = {"error": "Symbol not found"}
    return results

@app.post("/api/trading/modify")
async def modify_trading_order(data: dict):
    """Modifica niveles de una orden o posición."""
    platform = data.get("platform", "MT5")
    if platform == "MT4":
        return await mt4_service.modify_position(
            ticket=data["ticket"],
            sl=data.get("sl", 0),
            tp=data.get("tp", 0)
        )
        
    result = await mt5_service.modify_order(
        ticket=data["ticket"],
        sl=data.get("sl", 0),
        tp=data.get("tp", 0),
        price=data.get("price", 0)
    )
    return result

@app.post("/api/trading/close")
async def close_trading_position(data: dict):
    """Cierra o cancela una operación."""
    platform = data.get("platform", "MT5")
    if platform == "MT4":
        result = await mt4_service.close_position(ticket=data["ticket"], volume=data.get("volume", 0))
    else:
        result = await mt5_service.close_position(ticket=data["ticket"])
    return result

@app.websocket("/ws/prices/{symbol}")
async def websocket_prices(websocket: WebSocket, symbol: str):
    await websocket.accept()
    logging.info(f"== WS CONNECTION REQUEST: {symbol} ==")
    
    try:
        # 🛡️ NORMALIZACIÓN CENTRALIZADA (v12.1)
        target_symbol = mt5_service.translate_to_mt5_symbol(symbol)
        
        # Asegurar selección en Market Watch
        mt5.symbol_select(target_symbol, True)
        info = mt5.symbol_info(target_symbol)
        
        if not info:
            logging.error(f"Símbolo IMPOSIBLE de encontrar: {symbol} (Mapeado a: {target_symbol})")
            await websocket.send_json({"type": "error", "message": f"Symbol {symbol} (mapped to {target_symbol}) not found in MT5"})
            await websocket.close()
            return

        logging.info(f"Conectado a stream institucional: {target_symbol} (Original: {symbol})")
        
        # Sincronización inicial ultra-robusta (Normalizado a UTC)
        tick_data = mt5_service.get_last_tick(target_symbol)
        last_emitted_time = int(time.time())
        last_price = 0
        
        if tick_data:
            last_emitted_time = tick_data.get("time", last_emitted_time)
            last_price = tick_data.get("last", 0)
            if last_price <= 0: last_price = tick_data.get("bid", tick_data.get("ask", 0))
        
        logging.info(f"Stream institucional activo: {target_symbol} @ {last_emitted_time}")
        
        iteration = 0
        while True:
            # Captura de ráfaga
            ticks = mt5_service.get_ticks_range(target_symbol, last_emitted_time, 500)

            if ticks:
                # Convertir ráfaga a segundos si el servicio devolvió milisegundos
                for t in ticks:
                    if t["time"] > 2000000000: t["time"] = int(t["time"] / 1000)
                
                last_emitted_time = ticks[-1]["time"] + 1
                last_price = ticks[-1]["price"]
                await websocket.send_json({"type": "tick_burst", "data": ticks})
            else:
                # Heartbeat garantizado (Normalizado a UTC)
                if iteration % 10 == 0:
                    tick_data = mt5_service.get_last_tick(target_symbol)
                    
                    if tick_data:
                        price = tick_data["last"] if tick_data["last"] > 0 else (tick_data["bid"] if tick_data["bid"] > 0 else tick_data["ask"])
                        if price > 0: last_price = price
                        
                        hb_time = tick_data["time"]
                        last_emitted_time = hb_time
                        
                        try:
                            await websocket.send_json({
                                "type": "heartbeat",
                                "symbol": symbol,
                                "time": hb_time,
                                "price": price,
                                "bid": tick_data["bid"],
                                "ask": tick_data["ask"],
                                "last": tick_data["last"]
                            })
                        except Exception as e:
                            if "close message" not in str(e).lower():
                                logging.warning(f"Aviso en heartbeat para {symbol}: {e}")
                            break # Salimos del loop si el socket está dando problemas reales

            iteration += 1
            await asyncio.sleep(0.1)
            
    except WebSocketDisconnect:
        logging.info(f"Desconexión normal del stream: {symbol}")
    except Exception as e:
        error_msg = f"FALLO CRÍTICO EN STREAM {symbol}: {str(e)}"
        logging.error(error_msg)
        try:
            # Intentamos enviar el error al frontend antes de morir
            await websocket.send_json({"type": "error", "message": error_msg})
            await websocket.close()
        except:
            pass

@app.websocket("/ws/orderflow/{symbol}")
async def websocket_orderflow(websocket: WebSocket, symbol: str):
    await websocket.accept()
    target_symbol = symbol
    connection_start_time = asyncio.get_event_loop().time()
    reconnect_count = 0
    MAX_RECONNECTS = 5
    MIN_CONNECTION_DURATION = 10  # segundos mínimos para considerar una conexión exitosa

    async def send_msg(msg):
        """Envía mensaje al frontend de forma segura.
        
        Solo lanza ClientDisconnected si el WebSocket está realmente cerrado.
        Errores transitorios (timeout, buffer) se loguean pero no rompen la conexión.
        """
        try:
            await websocket.send_json(msg)
            return True
        except Exception as e:
            error_str = str(e).lower()
            # Solo propagar ClientDisconnected si el socket está realmente muerto
            if any(k in error_str for k in ['close', 'disconnect', '1006', '1001', '1000']):
                raise RuntimeError("ClientDisconnected")
            # Errores transitorios: loguear pero no romper conexión
            logging.debug(f"[OrderFlow] Error transitorio enviando mensaje: {e}")
            return False

    try:
        # Bucle de persistencia institucional
        while reconnect_count < MAX_RECONNECTS:
            loop_start_time = asyncio.get_event_loop().time()
            
            if target_symbol == "DEMO":
                from app.services.virtual_feed import virtual_feed
                await virtual_feed.stream_data(target_symbol, send_msg)
                break
                
            # Pequeña espera para asegurar que el servicio ha cargado la config del disco
            if not rithmic_service.user:
                await asyncio.sleep(0.5)
            
            if rithmic_service.user and rithmic_service.password:
                logging.info(f"[OrderFlow] Intentando flujo REAL Rithmic para {target_symbol} (intento {reconnect_count + 1}/{MAX_RECONNECTS})...")
                try:
                    await rithmic_service.stream_data(target_symbol, send_msg)
                    # Si stream_data termina normalmente, verificar duración
                    connection_duration = asyncio.get_event_loop().time() - loop_start_time
                    if connection_duration < MIN_CONNECTION_DURATION:
                        logging.warning(f"[OrderFlow] Conexión muy corta ({connection_duration:.1f}s), posible problema")
                        reconnect_count += 1
                    else:
                        # Conexión exitosa y duradera, resetear contador
                        reconnect_count = 0
                except RuntimeError as e:
                    if str(e) == "ClientDisconnected":
                        logging.info(f"[OrderFlow] Cliente desconectado limpiamente")
                        break
                    raise
                except Exception as e:
                    logging.error(f"[OrderFlow] Error en stream_data: {e}")
                    reconnect_count += 1
                    
                if reconnect_count < MAX_RECONNECTS:
                    wait_time = min(5 * reconnect_count, 30)  # Backoff exponencial
                    logging.info(f"[OrderFlow] Reintentando en {wait_time}s...")
                    await asyncio.sleep(wait_time)
            else:
                logging.info(f"[OrderFlow] Usando simulador DXFeed para {target_symbol}")
                try:
                    await dxfeed_mock.simulate_orderflow(target_symbol, send_msg)
                except RuntimeError as e:
                    if str(e) == "ClientDisconnected":
                        break
                await asyncio.sleep(1)
                
        if reconnect_count >= MAX_RECONNECTS:
            logging.error(f"[OrderFlow] Máximo de reconexiones alcanzado para {target_symbol}")
            try:
                await websocket.send_json({"type": "error", "message": "Max reconnection attempts reached"})
            except:
                pass
                
    except WebSocketDisconnect:
        logging.info(f"[OrderFlow] Desconexión controlada para {target_symbol}")
    except Exception as e:
        if "close message" not in str(e).lower() and str(e) != "ClientDisconnected":
            logging.error(f"[OrderFlow] WebSocket Error fatal: {e}")
    finally:
        try:
            await websocket.close()
        except:
            pass
        total_duration = asyncio.get_event_loop().time() - connection_start_time
        logging.info(f"[OrderFlow] Canal finalizado para {target_symbol} (duración total: {total_duration:.1f}s)")

@app.get("/history/{symbol}")
@app.get("/api/history/{symbol}")
async def get_history(symbol: str, timeframe: str = "1m", count: int = 100):
    # 🛡️ NORMALIZACIÓN CENTRALIZADA
    target = mt5_service.translate_to_mt5_symbol(symbol)
    
    if target == "DEMO":
        from app.services.virtual_feed import virtual_feed
        return virtual_feed.get_history(count)

    # 🚀 ACTIVACIÓN FORZOSA: MetaTrader descarga datos si el símbolo está seleccionado
    mt5.symbol_select(target, True)
    
    # Usar el servicio normalizado para asegurar UTC
    tf = TF_MAP.get(timeframe, mt5.TIMEFRAME_M1)
    
    logging.info(f"[History] Cargando {count} velas de {timeframe} para {target} (Origen: {symbol})")
    data = mt5_service.get_historical_data(target, tf, count)
    
    if not data or len(data) == 0:
        logging.warning(f"[History] El broker no ha devuelto velas para {target}. Reintentando una vez...")
        # Pequeña espera por si MetaTrader está subscribiendose en caliente
        await asyncio.sleep(0.5)
        data = mt5_service.get_historical_data(target, tf, count)

    return data if data else []

import math

@app.get("/api/footprint/{symbol}")
async def get_history_footprint(symbol: str, timeframe: str = "1m", count: int = 1000, to_timestamp: int = None):
    """
    Motor Retroactivo de Footprint para Frontend.
    Soporta símbolos reales (MT5) y sintéticos (DEMO).
    """
    target = mt5_service.translate_to_mt5_symbol(symbol)
    if not target:
        return {}

    tf_seconds_map = {
        "1m": 60, "5m": 300, "15m": 900, "30m": 1800,
        "1h": 3600, "4h": 14400, "1d": 86400
    }
    tf_seconds = tf_seconds_map.get(timeframe, 60)

    # 🟢 CASO ESPECIAL: Símbolo DEMO (Generación Sintética)
    if target == "DEMO":
        from app.services.virtual_feed import virtual_feed
        candles = virtual_feed.get_history(count if count else 100)
        return _generate_mock_footprint(candles, 0.25)

    mt5.symbol_select(target, True)
    offset = mt5_service.get_broker_offset(target)
    
    # Determinar punto de anclaje (Anchor)
    
    # Determinar punto de anclaje (Anchor)
    timeframe_mt5 = TF_MAP.get(timeframe, mt5.TIMEFRAME_M1)
    try:
        if to_timestamp:
            logging.info(f"[Footprint] Paginando al pasado desde {datetime.fromtimestamp(to_timestamp)}")
            # 1. Ajustar el timestamp de búsqueda a hora del broker
            broker_to_timestamp = to_timestamp + offset
            # 2. Obtener los timestamps de las 50 velas previas (Chunking Seguro)
            rates = mt5.copy_rates_from(symbol, timeframe_mt5, broker_to_timestamp, 50)
            
            if rates is not None and len(rates) > 0:
                start_time = datetime.fromtimestamp(rates[0][0])
                end_time = datetime.fromtimestamp(rates[-1][0] + tf_seconds)
                logging.info(f"[Footprint] Rango de velas encontrado: {start_time} -> {end_time} ({len(rates)} velas)")
                ticks = mt5.copy_ticks_range(symbol, start_time, end_time, mt5.COPY_TICKS_ALL)
            else:
                logging.error(f"[Footprint] No se encontraron velas previas para ancla {to_timestamp}")
                ticks = None
        else:
            # PARA EL PRESENTE: Usamos la hora actual del broker para pedir ticks
            broker_now = datetime.now().timestamp() + offset
            ticks = mt5.copy_ticks_from(symbol, int(broker_now), count, mt5.COPY_TICKS_ALL)

    except Exception as e:
        logging.exception(f"Error crítico en el puente MT5 al procesar ticks: {e}")
        return {}

    if ticks is None or len(ticks) == 0:
        error = mt5.last_error()
        logging.error(f"Fallo al obtener ticks históricos Footprint para {symbol}: {error}")
        return {}

    # 🔄 SINCRONIZACIÓN DE PRECIOS (UNIFICACIÓN RITHMIC)
    # Si Rithmic esta activo, usamos su precio actual como ancla para desplazar el historial de MT5
    from app.services.rithmic_service import rithmic_service
    price_offset = 0.0
    if rithmic_service.connected:
        rith_price = rithmic_service.get_last_price(symbol)
        if rith_price and len(ticks) > 0:
            # Obtener el ultimo precio de MT5 para comparar
            mt5_last = ticks[-1]['last'] if ticks[-1]['last'] > 0 else (ticks[-1]['bid'] or ticks[-1]['ask'])
            if mt5_last > 0:
                price_offset = rith_price - mt5_last
                logging.info(f"[Footprint] Sincronizando precio: Rithmic({rith_price}) - MT5({mt5_last}) = Offset({price_offset})")

    def get_tick_size(p: float) -> float:
        # 🟢 Optimización Pugobot: NAS100 requiere precisión de 0.25
        # ES/NQ (CME) comúnmente operan en centavos o cuartos
        if p > 10000: return 0.25 # NASDAQ / US Tech
        if p > 1000: return 0.25  # S&P 500 / Indices
        if p > 100: return 0.01   # Acciones
        if p > 5: return 0.01
        return 0.0001
    
    footprint = {}
    last_price = 0
    last_direction = 1 # 1: Ask, -1: Bid
    
    for tick in ticks:
        # Extraer precio dominante
        price = tick['last']
        if price <= 0:
            price = tick['bid'] if tick['bid'] > 0 else tick['ask']
        
        # Aplicar Sincronización
        price += price_offset
        
        if price <= 0: continue
            
        # Extraer volumen real o nominal
        vol = tick['volume_real'] if tick['volume_real'] > 0 else tick['volume']
        if vol <= 0: vol = 1
        
        # Test Tick Heurístico L2
        if price > last_price and last_price > 0:
            last_direction = 1
        elif price < last_price and last_price > 0:
            last_direction = -1
            
        last_price = price
        
        # Geometría Temporal (Binning por Vela) - Normalizado a UTC
        candle_time = math.floor(((tick['time_msc'] - (offset * 1000)) / 1000) / tf_seconds) * tf_seconds
        
        # Geometría de Precios (Binning por TickSize del Frontend)
        t_size = get_tick_size(price)
        rounded_price = str(math.floor(price / t_size) * t_size)
        
        if candle_time not in footprint:
            footprint[candle_time] = {}
            
        if rounded_price not in footprint[candle_time]:
            footprint[candle_time][rounded_price] = {"bid": 0, "ask": 0}
            
        if last_direction == 1:
            footprint[candle_time][rounded_price]["ask"] += vol
        else:
            footprint[candle_time][rounded_price]["bid"] += vol

    return footprint

def _generate_mock_footprint(candles, tick_size):
    """Genera un perfil de volumen bid/ask para velas sintéticas."""
    footprint = {}
    for c in candles:
        t = c['time']
        footprint[t] = {}
        
        # Determinar niveles de precio entre Low y High
        levels = []
        curr = c['low']
        while curr <= c['high'] + (tick_size / 2):
            levels.append(round(curr, 2))
            curr += tick_size
            
        if not levels: continue
        
        total_vol = c.get('tick_volume', 100)
        
        # POC centralizado en el cuerpo de la vela
        poc_price = round((c['open'] + c['close']) / 2 / tick_size) * tick_size
        
        for p in levels:
            p_str = str(p)
            # Distribución Gaussiana simplificada alrededor del POC
            dist = 1.0 / (1.0 + abs(p - poc_price) / tick_size)
            level_vol = int(total_vol * dist * (0.5 + random.random() * 0.5))
            
            # Generar Delta
            # Si el precio está en el extremo superior de una vela bajista -> Bearish Absorption
            # Si el precio está en el extremo inferior de una vela alcista -> Bullish Absorption
            delta_bias = 0
            if c['close'] < c['open'] and p >= c['high'] - tick_size:
                delta_bias = 0.4 # Agresividad compradora atrapada arriba
            elif c['close'] > c['open'] and p <= c['low'] + tick_size:
                delta_bias = -0.4 # Agresividad vendedora atrapada abajo
                
            ask_ratio = (0.5 + delta_bias) + (random.random() * 0.2 - 0.1)
            ask_ratio = max(0.1, min(0.9, ask_ratio))
            
            footprint[t][p_str] = {
                "ask": int(level_vol * ask_ratio),
                "bid": int(level_vol * (1 - ask_ratio))
            }
            
    return footprint

if __name__ == "__main__":
    import uvicorn
    # Forzamos 0.0.0.0 para evitar problemas de IPv6/localhost en Windows
    uvicorn.run(app, host="0.0.0.0", port=8000)

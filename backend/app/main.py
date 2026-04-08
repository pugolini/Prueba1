from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.services.mt5_service import mt5_service
from app.services.mt4_service import mt4_service
from app.services.dxfeed_service import dxfeed_mock
from app.services.rithmic_service import rithmic_service
import MetaTrader5 as mt5
import asyncio
import json
import logging
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

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Inicio: Conexión a MetaTrader 5
    if not mt5_service.initialize():
        logging.error("No se pudo conectar a MetaTrader 5 al iniciar.")
    yield
    # Cierre: Desconexión limpia
    mt5_service.shutdown()

app = FastAPI(title="Pugobot Trading API", lifespan=lifespan)

# CORS para el frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

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

def resolve_symbol(symbol: str):
    """Prueba el símbolo original y variantes con sufijos comunes."""
    if mt5.symbol_select(symbol, True):
        return symbol
    
    base = symbol.split('.')[0]
    for suffix in [".pro", ".fs", ""]:
        test_sym = f"{base}{suffix}"
        if mt5.symbol_select(test_sym, True):
            return test_sym
    return None

@app.get("/api/all_symbols")
async def list_all_symbols():
    """Endpoint de diagnóstico para listar todos los símbolos del broker."""
    symbols = mt5.symbols_get()
    if not symbols: return []
    return [s.name for s in symbols]

@app.get("/status/{symbol}")
@app.get("/api/status/{symbol}")
async def get_status(symbol: str):
    target = resolve_symbol(symbol)
    if not target:
        return {"status": "error", "message": f"Symbol {symbol} (and variants) not found"}
    
    info = mt5.symbol_info(target)
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
        target = resolve_symbol(s)
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
        # Normalización robusta de símbolo
        target_symbol = symbol
        mt5.symbol_select(target_symbol, True)
        info = mt5.symbol_info(target_symbol)
        
        if not info:
            logging.warning(f"Símbolo {target_symbol} no encontrado inicialmente. Probando variantes...")
            # Extraer base sin sufijo
            base = symbol.split('.')[0]
            for suffix in [".fs", ".pro", ""]:
                test_sym = f"{base}{suffix}"
                if mt5.symbol_select(test_sym, True):
                    info = mt5.symbol_info(test_sym)
                    if info:
                        target_symbol = test_sym
                        logging.info(f"Símbolo LOCALIZADO y SELECCIONADO: {target_symbol}")
                        break
        
        if not info:
            logging.error(f"Símbolo IMPOSIBLE de encontrar: {symbol}")
            await websocket.send_json({"type": "error", "message": f"Symbol {symbol} not found in MT5"})
            await websocket.close()
            return

        logging.info(f"Conectado a stream institucional: {target_symbol}")
        
        # Sincronización inicial ultra-robusta
        tick = mt5.symbol_info_tick(target_symbol)
        last_emitted_time = int(datetime.now().timestamp() * 1000)
        last_price = 0
        
        if tick is not None:
            # Convertimos a diccionario para evitar líos de numpy.void
            try:
                t_dict = tick._asdict() if hasattr(tick, "_asdict") else {
                    "time_msc": getattr(tick, "time_msc", last_emitted_time),
                    "last": getattr(tick, "last", 0),
                    "bid": getattr(tick, "bid", 0),
                    "ask": getattr(tick, "ask", 0)
                }
                last_emitted_time = t_dict.get("time_msc", last_emitted_time)
                last_price = t_dict.get("last", 0)
                if last_price <= 0: last_price = t_dict.get("bid", t_dict.get("ask", 0))
            except:
                last_emitted_time = int(datetime.now().timestamp() * 1000)
        
        logging.info(f"Stream institucional activo: {target_symbol} @ {last_emitted_time}")
        
        iteration = 0
        while True:
            # Captura de ráfaga
            ticks = mt5_service.get_ticks_range(target_symbol, last_emitted_time, 500)

            if ticks:
                last_emitted_time = ticks[-1]["time"] + 1
                last_price = ticks[-1]["price"]
                await websocket.send_json({"type": "tick_burst", "data": ticks})
            else:
                # Heartbeat garantizado
                if iteration % 10 == 0:
                    current_tick = mt5.symbol_info_tick(target_symbol)
                    price = last_price
                    bid, ask, last = 0, 0, 0
                    
                    if current_tick is not None:
                        try:
                            # Acceso seguro para heartbeat
                            c_dict = current_tick._asdict() if hasattr(current_tick, "_asdict") else {}
                            bid = c_dict.get("bid", getattr(current_tick, "bid", 0))
                            ask = c_dict.get("ask", getattr(current_tick, "ask", 0))
                            last = c_dict.get("last", getattr(current_tick, "last", 0))
                            price = last if last > 0 else (bid if bid > 0 else ask)
                            if price > 0: last_price = price
                            
                            # Usamos last_emitted_time + 1 para garantizar orden ascendente estricto
                            # Evitamos usar datetime.now() porque puede haber colisiones con MT5
                            hb_time = max(int(datetime.now().timestamp() * 1000), last_emitted_time + 1)
                            last_emitted_time = hb_time
                            
                            await websocket.send_json({
                                "type": "heartbeat",
                                "symbol": symbol,
                                "time": hb_time,
                                "price": price,
                                "bid": bid,
                                "ask": ask,
                                "last": last
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

    async def send_msg(msg):
        try:
            await websocket.send_json(msg)
            return True
        except Exception as e:
            raise RuntimeError("ClientDisconnected")

    try:
        # Bucle de persistencia institucional
        while True:
            # Pequeña espera para asegurar que el servicio ha cargado la config del disco
            if not rithmic_service.user:
                await asyncio.sleep(0.5)
            
            if rithmic_service.user and rithmic_service.password:
                logging.info(f"[OrderFlow] Intentando flujo REAL Rithmic para {target_symbol}...")
                try:
                    await rithmic_service.stream_data(target_symbol, send_msg)
                except RuntimeError as e:
                    if str(e) == "ClientDisconnected":
                        break
                await asyncio.sleep(5) 
            else:
                logging.info(f"[OrderFlow] Usando simulador DXFeed para {target_symbol}")
                try:
                    await dxfeed_mock.simulate_orderflow(target_symbol, send_msg)
                except RuntimeError as e:
                    if str(e) == "ClientDisconnected":
                        break
                await asyncio.sleep(1)
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
        logging.info(f"[OrderFlow] Canal finalizado para {target_symbol}")

@app.get("/history/{symbol}")
@app.get("/api/history/{symbol}")
async def get_history(symbol: str, timeframe: str = "1m", count: int = 100):
    target = resolve_symbol(symbol)
    if not target:
        logging.error(f"Símbolo no encontrado (Historial): {symbol}")
        return []

    tf = TF_MAP.get(timeframe, mt5.TIMEFRAME_M1)
    
    # Aseguramos que el símbolo esté seleccionado
    mt5.symbol_select(target, True)
    
    bars = mt5.copy_rates_from_pos(target, tf, 0, count)
    if bars is None:
        error = mt5.last_error()
        logging.error(f"Fallo al obtener historial para {target}: {error}")
        return []
    
    return [
        {
            "time": int(bar[0]),
            "open": float(bar[1]),
            "high": float(bar[2]),
            "low": float(bar[3]),
            "close": float(bar[4]),
            "tick_volume": int(bar[5])
        } for bar in bars
    ]

import math

@app.get("/api/history-footprint/{symbol}")
async def get_history_footprint(symbol: str, timeframe: str = "1m", count: int = 100000, to_timestamp: int = None):
    """
    Motor Retroactivo de Footprint para Frontend Lazy-Loading.
    Consume hasta 100k ticks de MT5, emula lógica L2 Heurística y devuelve Celdas Footprint.
    """
    tf_seconds_map = {
        "1m": 60, "5m": 300, "15m": 900, "30m": 1800,
        "1H": 3600, "4H": 14400, "1D": 86400
    }
    tf_seconds = tf_seconds_map.get(timeframe, 60)
    
    mt5.symbol_select(symbol, True)
    
    # Determinar punto de anclaje (Anchor)
    timeframe_mt5 = TF_MAP.get(timeframe, mt5.TIMEFRAME_M1)
    try:
        if to_timestamp:
            logging.info(f"[Footprint] Paginando al pasado desde {datetime.fromtimestamp(to_timestamp)}")
            # 1. Obtener los timestamps de las 50 velas previas (Chunking Seguro)
            rates = mt5.copy_rates_from(symbol, timeframe_mt5, to_timestamp, 50)
            
            if rates is not None and len(rates) > 0:
                start_time = datetime.fromtimestamp(rates[0][0])
                end_time = datetime.fromtimestamp(rates[-1][0] + tf_seconds)
                logging.info(f"[Footprint] Rango de velas encontrado: {start_time} -> {end_time} ({len(rates)} velas)")
                ticks = mt5.copy_ticks_range(symbol, start_time, end_time, mt5.COPY_TICKS_ALL)
            else:
                logging.error(f"[Footprint] No se encontraron velas previas para ancla {to_timestamp}")
                ticks = None
        else:
            # PARA EL PRESENTE
            ticks = mt5.copy_ticks_from(symbol, datetime.now(), count, mt5.COPY_TICKS_ALL)

    except Exception as e:
        logging.exception(f"Error crítico en el puente MT5 al procesar ticks: {e}")
        return {}

    if ticks is None or len(ticks) == 0:
        error = mt5.last_error()
        logging.error(f"Fallo al obtener ticks históricos Footprint para {symbol}: {error}")
        return {}

    def get_tick_size(p: float) -> float:
        if p > 10000: return 5.0
        if p > 1000: return 1.0
        if p > 100: return 0.05
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
        
        # Geometría Temporal (Binning por Vela)
        candle_time = math.floor((tick['time_msc'] / 1000) / tf_seconds) * tf_seconds
        
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

if __name__ == "__main__":
    import uvicorn
    # Forzamos 0.0.0.0 para evitar problemas de IPv6/localhost en Windows
    uvicorn.run(app, host="0.0.0.0", port=8005)

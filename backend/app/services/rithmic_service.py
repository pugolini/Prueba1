import asyncio
import logging
import json
import os
from datetime import datetime, timedelta
from async_rithmic.client import RithmicClient
from async_rithmic.enums import DataType, SysInfraType
from google.protobuf.json_format import MessageToDict

from collections import deque
 
class RithmicService:
    def __init__(self):
        self.user = ""
        self.password = ""
        self.system = "Rithmic 01"
        self.connected = False
        self.running = False
        self._client = None
        self._subscribers = {}  # {symbol: [callback, ...]}
        self._subscribed_symbols = set()
        self._rithmic_to_ext = {}  # {rithmic_symbol: external_symbol}
        self._lock = asyncio.Lock() # Bloqueo para evitar colisiones de login
        self._last_heatmap_ts = {}  # {symbol: float} - throttle heatmap broadcasts
        self._order_books = {}  # {symbol: {price_str: size}} - book acumulado
        self._heatmap_histories = {} # {symbol: deque(maxlen=600)} - Buffering historical depth
        self._last_bbo = {} # {symbol: {'bid': float, 'ask': float}} - Para detectar agresión en trades
        self.config_file = "rithmic_config.json"
        
        self.app_name = "RTraderPro"
        self.app_version = "1.0"
        self.gateway_url = "rprotocol.rithmic.com:443"
        
        self.load_from_file()

    def update_config(self, user, password, system):
        self.user = user
        self.password = password
        self.system = system or "Rithmic 01"
        self.save_to_file()
        logging.info(f"[RITHMIC] Configuracion persistente guardada para {self.user}")

    def save_to_file(self):
        try:
            with open(self.config_file, "w") as f:
                json.dump({"user": self.user, "pass": self.password, "system": self.system}, f)
        except Exception as e:
            logging.error(f"[RITHMIC] Error guardando config: {e}")

    def load_from_file(self):
        try:
            import os
            if os.path.exists(self.config_file):
                with open(self.config_file, "r") as f:
                    data = json.load(f)
                    self.user = data.get("user", "")
                    self.password = data.get("pass", "")
                    self.system = data.get("system", "Rithmic 01")
                    logging.info(f"[RITHMIC] Configuracion cargada: {self.user} ({self.system})")
        except Exception as e:
            logging.error(f"[RITHMIC] Error cargando config: {e}")

    def translate_symbol(self, symbol):
        symbol_map = {
            # Índices (CME)
            "NAS100": ("NQ", "CME"),
            "US100":  ("NQ", "CME"),
            "USTEC":  ("NQ", "CME"),
            "NASDAQ": ("NQ", "CME"),
            "NQ":     ("NQ", "CME"),
            "US30":   ("YM", "CBOT"),
            "DOW":    ("YM", "CBOT"),
            "SP500":  ("ES", "CME"),
            "US500":  ("ES", "CME"),
            "ES":     ("ES", "CME"),
            "SPX500": ("ES", "CME"),
            "US2000": ("RTY", "CME"),
            # Metales (NYMEX/COMEX)
            "XAUUSD": ("GC", "NYMEX"),
            "GOLD":   ("GC", "NYMEX"),
            "GC":     ("GC", "NYMEX"),
            "XAGUSD": ("SI", "NYMEX"),
            "SILVER": ("SI", "NYMEX"),
            "SI":     ("SI", "NYMEX"),
            # Energía (NYMEX)
            "USOIL":  ("CL", "NYMEX"),
            "OIL":    ("CL", "NYMEX"),
            "CL":     ("CL", "NYMEX"),
            # Forex Futuros (CME)
            "EURUSD": ("6E", "CME"),
            "GBPUSD": ("6B", "CME"),
            "USDJPY": ("6J", "CME"),
            "AUDUSD": ("6A", "CME"),
        }
        base_symbol = symbol.split('.')[0].upper()
        return symbol_map.get(base_symbol, (base_symbol, "CME"))

    def _is_client_connected(self):
        """Verifica si el cliente esta realmente conectado mirando sus plantas."""
        if not self._client:
            return False
        
        # En 1.5.9, el status se mira en las plantas individuales o en el socket
        try:
            # Prioridad 1: Flag interno de sesión activa (más confiable para evitar cierres prematuros)
            if self.connected:
                return True

            # Opción A: tiene plantas (ticker, history, etc)
            if hasattr(self._client, 'plants') and self._client.plants:
                return any(getattr(p, 'is_connected', False) for p in self._client.plants.values())
            
            # Opción B: fallback al socket interno si existe
            if hasattr(self._client, 'ws') and self._client.ws:
                return not self._client.ws.closed
                
            return False
        except:
            return False

    async def connect(self):
        """Asegura una conexion unica y compartida con reintento."""
        async with self._lock:
            if self.connected and self._is_client_connected():
                return True

            try:
                logging.info(f"[RITHMIC] Abriendo sesion maestra en {self.gateway_url} (System: {self._normalize_system(self.system)})...")
                
                # Limpiar cliente anterior si existe
                if self._client:
                    try: await self._client.disconnect()
                    except: pass

                self._client = RithmicClient(
                    user=self.user,
                    password=self.password,
                    system_name=self._normalize_system(self.system),
                    app_name=self.app_name,
                    app_version=self.app_version,
                    url=self.gateway_url
                )
                
                self._client.on_tick += self._on_tick_received
                self._client.on_order_book += self._on_order_book_received
                
                # IMPORTANTE: Apex a menudo separa datos de ejecucion. Solo pedimos Ticker y Historia.
                await self._client.connect(plants=[SysInfraType.TICKER_PLANT, SysInfraType.HISTORY_PLANT])
                self.connected = True
                self.running = True
                
                # BUGFIX: Dar un pequeño margen para que las plantas reporten is_connected
                await asyncio.sleep(0.5)
                
                logging.info(f"[RITHMIC] SESION MAESTRA ACTIVA")
                return True
            except Exception as e:
                logging.error(f"[RITHMIC] Fallo al abrir sesion maestra: {e}")
                self.connected = False
                return False

    def _normalize_system(self, system):
        mapping = {
            "Apex Trader Funding": "Apex",
            "Apex": "Apex",
            "Rithmic 01": "Rithmic 01",
            "Rithmic Paper Trading": "Rithmic Paper Trading"
        }
        return mapping.get(system, "Apex") # Default a Apex si hay duda

    async def _resolve_rithmic_symbol(self, symbol, exchange):
        """Resuelve un simbolo base (NQ) al contrato front month (NQM6) si es necesario."""
        if not self._client: return symbol
        
        # 1. Si el simbolo ya tiene formato de contrato (ej NQH5, NQM6), lo dejamos estar
        if any(char.isdigit() for char in symbol):
            return symbol

        # 2. Intentar resolver via Ticker Plant
        try:
            ticker = self._client.plants.get('ticker')
            if ticker:
                logging.info(f"[RITHMIC] Resolviendo contrato Front Month para {symbol}...")
                resolved = await ticker.get_front_month_contract(symbol, exchange)
                if resolved:
                    logging.info(f"[RITHMIC] Simbolo resuelto: {symbol} -> {resolved}")
                    return resolved
        except Exception as e:
            logging.error(f"[RITHMIC] Error resolviendo Front Month para {symbol}: {e}")
        
        # 3. Fallback: Si falla el ticker, intentamos una deducción manual común (NQ -> NQM6 para Jun 25/26)
        # Esto es solo un salvavidas por si el TickerPlant de Rithmic tarda en responder
        return symbol

    async def get_historical_data_dual(self, symbol: str, timeframe_minutes: int = 1, since_ts: int = 0):
        """
        Arquitectura de Doble Capa para Rithmic:
        
        1. Barras Agregadas (Capa Light): Todo el rango desde since_ts.
           Devuelve OHLCV + netDelta por vela. Ideal para gráfico y contexto histórico.
           
        2. Footprint Maps (Capa Detalle): SOLO últimas 48h.
           Devuelve {precio: {bid, ask}} por minuto. Necesario para Order Flow / Diamantes.
           
        Esto evita sobrecargar Rithmic con miles de ticks para el pasado lejano.
        """
        try:
            # BUGFIX: No forzar reconexion si ya hay sesion activa (evita matar el stream en vivo)
            if not self.connected or not self._is_client_connected():
                if not await self.connect():
                    return {"bars": {}, "footprintMaps": {}}

            base_symbol, exchange = self.translate_symbol(symbol)
            target_symbol = await self._resolve_rithmic_symbol(base_symbol, exchange)
            
            import pytz
            from datetime import timedelta
            
            ny_tz = pytz.timezone('America/New_York')
            now_ny = datetime.now(ny_tz)
            now_utc = datetime.utcnow()
            
            # --- VENTANA TEMPORAL ---
            if since_ts > 0:
                start_utc = datetime.utcfromtimestamp(since_ts)
                # Seguridad: no pedir más de 90 días
                min_start = now_utc - timedelta(days=90)
                if start_utc < min_start:
                    start_utc = min_start
            else:
                start_utc = now_utc - timedelta(days=90)
            
            end_utc = now_utc
            
            logging.info(f"[RITHMIC-DUAL] {target_symbol}: barras desde {start_utc}, footprint desde max({start_utc}, {now_utc - timedelta(hours=48)})")
            
            # === CAPA 1: BARRAS AGREGADAS (todo el rango) ===
            bars_task = self._get_bar_history(
                target_symbol, exchange, timeframe_minutes, 
                start_utc, end_utc
            )
            
            # === CAPA 2: FOOTPRINT MAPS (solo últimas 48h) ===
            footprint_cutoff = max(start_utc, now_utc - timedelta(hours=48))
            footprint_task = self._get_tick_footprints(
                target_symbol, exchange, timeframe_minutes,
                footprint_cutoff, end_utc
            ) if (end_utc - footprint_cutoff).total_seconds() > 60 else asyncio.sleep(0)
            
            bars, footprint_maps = await asyncio.gather(bars_task, footprint_task)
            
            logging.info(
                f"[RITHMIC-DUAL] {symbol}: {len(bars)} barras, "
                f"{len(footprint_maps)} footprint maps (últimas 48h)"
            )
            
            return {
                "bars": bars,
                "footprintMaps": footprint_maps if isinstance(footprint_maps, dict) else {}
            }
            
        except Exception as e:
            logging.error(f"[RITHMIC-DUAL] Fallo crítico: {e}", exc_info=True)
            return {"bars": {}, "footprintMaps": {}}

    async def _get_bar_history(self, symbol: str, exchange: str, tf_minutes: int, start: datetime, end: datetime):
        """
        Obtiene barras históricas agregadas de Rithmic (History Plant).
        Mucho más eficiente que pedir ticks: 1 petición = miles de velas.
        Retorna: { timestamp_segundos: { open, high, low, close, volume, netDelta } }
        """
        history = self._client.plants.get('history')
        if not history:
            logging.error("[RITHMIC] History Plant no disponible para barras")
            return {}
        
        bars_dict = {}
        
        try:
            # get_historical_time_bars espera bar_type según TimeBarType
            # 1 = 1 minute, 2 = 5 minutes, etc.
            bar_type_map = {1: 1, 5: 2, 15: 3, 30: 4, 60: 5, 240: 6, 1440: 7}
            bar_type = bar_type_map.get(tf_minutes, 1)
            
            bars = await history.get_historical_time_bars(
                symbol=symbol,
                exchange=exchange,
                bar_type=bar_type,
                start_time=start,
                end_time=end
            )
            
            if not bars:
                logging.warning(f"[RITHMIC] No se recibieron barras para {symbol}")
                return {}
            
            for b in bars:
                try:
                    ts = int(b.get('open_ssboe', 0))
                    if ts <= 0:
                        dt = b.get('datetime')
                        if dt:
                            ts = int(dt.timestamp())
                    
                    if ts <= 0:
                        continue
                    
                    # Normalizar al inicio del timeframe
                    ts_norm = int(ts / (tf_minutes * 60)) * (tf_minutes * 60)
                    
                    open_p = float(b.get('open_price', 0))
                    high_p = float(b.get('high_price', 0))
                    low_p = float(b.get('low_price', 0))
                    close_p = float(b.get('close_price', 0))
                    vol = float(b.get('volume', 0))
                    
                    # Delta neto desde Rithmic: ask_volume - bid_volume
                    bid_vol = float(b.get('bid_volume') or 0)
                    ask_vol = float(b.get('ask_volume') or 0)
                    net_delta = ask_vol - bid_vol
                    
                    bars_dict[ts_norm] = {
                        'open': open_p,
                        'high': high_p,
                        'low': low_p,
                        'close': close_p,
                        'volume': vol,
                        'netDelta': net_delta
                    }
                except Exception as e:
                    continue
                    
        except Exception as e:
            logging.error(f"[RITHMIC] Error en _get_bar_history: {e}")
        
        return bars_dict

    async def _get_tick_footprints(self, symbol: str, exchange: str, tf_minutes: int, start: datetime, end: datetime):
        """
        Reconstruye footprint maps REALES agregando ticks de 1 trade.
        Solo para ventanas cortas (máx 48h) para no saturar Rithmic.
        Retorna: { timestamp_segundos: { precio_str: {bid, ask} } }
        """
        history = self._client.plants.get('history')
        if not history:
            return {}
        
        footprint_by_minute = {}
        chunk_hours = 2
        current_start = start
        
        while current_start < end:
            current_end = min(current_start + timedelta(hours=chunk_hours), end)
            
            try:
                ticks = await history.get_historical_tick_data(
                    symbol=symbol,
                    exchange=exchange,
                    start_time=current_start,
                    end_time=current_end
                )
                
                if ticks:
                    for t in ticks:
                        try:
                            dt = t.get('datetime')
                            if not dt:
                                continue
                            
                            ts_raw = dt.timestamp()
                            ts_min = int(ts_raw / (tf_minutes * 60)) * (tf_minutes * 60)
                            
                            price = float(t.get('close_price') or t.get('open_price') or 0)
                            if price == 0:
                                continue
                            
                            bid_vol = float(t.get('bid_volume') or 0)
                            ask_vol = float(t.get('ask_volume') or 0)
                            
                            # Fallback: si ask_vol es null, inferir
                            if ask_vol == 0 and bid_vol > 0:
                                total_vol = float(t.get('volume') or 0)
                                ask_vol = max(0, total_vol - bid_vol)
                            
                            p_key = f"{price:.2f}"
                            
                            if ts_min not in footprint_by_minute:
                                footprint_by_minute[ts_min] = {}
                            
                            if p_key not in footprint_by_minute[ts_min]:
                                footprint_by_minute[ts_min][p_key] = {'bid': 0, 'ask': 0}
                            
                            footprint_by_minute[ts_min][p_key]['bid'] += bid_vol
                            footprint_by_minute[ts_min][p_key]['ask'] += ask_vol
                            
                        except Exception:
                            continue
                            
            except Exception as e:
                logging.warning(f"[RITHMIC] Fallo chunk {current_start}: {e}")
            
            current_start = current_end
        
        return footprint_by_minute

    async def get_historical_deltas(self, symbol: str, timeframe_minutes: int = 1, since_ts: int = 0):
        """
        Obtiene el Delta exacto histórico desde Rithmic (History Plant).
        Si since_ts > 0, solo solicita desde ese timestamp hasta ahora.
        Soporta hasta 3 meses (90 días) máximo por limitación de Rithmic.
        Retorna: { timestamp_segundos: delta_valor }
        """
        try:
            # 1. Asegurar conexion
            if not await self.connect():
                return {}

            # 2. Traducir símbolo y resolver contrato front month
            base_symbol, exchange = self.translate_symbol(symbol)
            target_symbol = await self._resolve_rithmic_symbol(base_symbol, exchange)
            
            # 3. Calcular ventana temporal: Desde hace X días hasta ahora
            import pytz
            from datetime import timedelta
            
            ny_tz = pytz.timezone('America/New_York')
            now_ny = datetime.now(ny_tz)
            
            if since_ts > 0:
                # Si nos pasan un timestamp, empezamos desde ahí
                start_time_utc = datetime.utcfromtimestamp(since_ts)
                # Seguridad: No pedir más de 90 días atrás
                min_start = datetime.utcnow() - timedelta(days=90)
                if start_time_utc < min_start:
                    start_time_utc = min_start
            else:
                # Calculamos inicio: Hace 90 días a las 00:00 NY (Default)
                start_time_ny = (now_ny - timedelta(days=90)).replace(hour=0, minute=0, second=0, microsecond=0)
                start_time_utc = start_time_ny.astimezone(pytz.UTC).replace(tzinfo=None)
            
            end_time_utc = datetime.utcnow()

            logging.info(f"[RITHMIC] Solicitando Delta Histórico para {target_symbol} desde {start_time_utc} UTC")

            history = self._client.plants.get('history')
            if not history:
                logging.error("[RITHMIC] History Plant no disponible")
                return {}

            deltas_by_minute = {}
            current_start = start_time_utc
            chunk_hours = 2 # Paginar solicitando ticks en ventanas de 2 horas para eludir el estrangulamiento del broker
            
            while current_start < end_time_utc:
                current_end = min(current_start + timedelta(hours=chunk_hours), end_time_utc)
                logging.info(f"[RITHMIC] Fetching tick chunk: {current_start} -> {current_end}")
                
                try:
                    ticks = await history.get_historical_tick_data(
                        symbol=target_symbol,
                        exchange=exchange,
                        start_time=current_start,
                        end_time=current_end
                    )
                except Exception as loop_e:
                    logging.warning(f"[RITHMIC] Fallo al recuperar chunk {current_start}: {loop_e}")
                    ticks = []

                if ticks:
                    for t in ticks:
                        try:
                            dt = t.get('datetime')
                            if not dt: continue
                            
                            ts_raw = dt.timestamp()
                            import math
                            ts_min = int(math.floor(ts_raw / (timeframe_minutes * 60))) * (timeframe_minutes * 60)
                            
                            vol = float(t.get('volume', 0))
                            bid_vol = float(t.get('bid_volume', 0))
                            # Debug: Verificar si Rithmic envía bid_volume
                            if vol > 0 and bid_vol > 0:
                                logging.debug(f"[RITHMIC] Tick Delta Debug: vol={vol}, bid={bid_vol}")
                                
                            tick_delta = (vol - bid_vol) - bid_vol 
                            
                            deltas_by_minute[ts_min] = deltas_by_minute.get(ts_min, 0) + tick_delta
                        except Exception as e:
                            pass
                
                current_start = current_end

            logging.info(f"[RITHMIC] Delta histórico procesado: {len(deltas_by_minute)} velas para {symbol}")
            return deltas_by_minute

        except Exception as e:
            logging.error(f"[RITHMIC] Fallo crítico en get_historical_deltas: {e}")
            return {}

    async def stream_data(self, symbol, callback):
        """Agrega un suscriptor al flujo compartido con diagnostico extendido."""
        base_symbol, exchange = self.translate_symbol(symbol)
        
        try:
            # 1. Asegurar conexion
            if not await self.connect():
                await callback({"type": "status_update", "source": "rithmic", "connected": False, "error": "Auth failed"})
                return

            # 2. Resolver simbolo real de Rithmic (Front Month)
            target_symbol = await self._resolve_rithmic_symbol(base_symbol, exchange)

            # 3. Registrar suscriptor y Mapear Simbolo PRONTO (CRÍTICO)
            self._rithmic_to_ext[target_symbol] = symbol
            logging.info(f"[RITHMIC] Registro de ruteo: {target_symbol} -> {symbol}")

            if symbol not in self._subscribers:
                self._subscribers[symbol] = []
            
            if callback not in self._subscribers[symbol]:
                self._subscribers[symbol].append(callback)
                logging.info(f"[RITHMIC] Nuevo suscriptor WS para {symbol} (mapeado a {target_symbol})")
            
            # Notificar exito al frontend
            await callback({"type": "status_update", "source": "rithmic", "connected": True, "resolved_symbol": target_symbol})

            # 3.5 Enviar HISTORIAL de heatmap guardado (si existe)
            if symbol in self._heatmap_histories:
                history = list(self._heatmap_histories[symbol])
                if history:
                    logging.info(f"[RITHMIC] Enviando {len(history)} snapshots de historial para {symbol}")
                    await callback({
                        "type": "heatmap_history",
                        "symbol": str(symbol),
                        "data": history
                    })

            # 4. Suscribir en Rithmic si es el primer interesado
            if target_symbol not in self._subscribed_symbols:
                try:
                    logging.info(f"[RITHMIC] Suscribiendo a {target_symbol} @ {exchange}...")
                    await self._client.subscribe_to_market_data(
                        symbol=target_symbol,
                        exchange=exchange,
                        data_type=DataType.LAST_TRADE | DataType.BBO | DataType.ORDER_BOOK
                    )
                    self._subscribed_symbols.add(target_symbol)
                except Exception as e:
                    logging.error(f"[RITHMIC] Error en subscribe_to_market_data para {target_symbol}: {e}")

            # 5. Bucle de vitalidad con Heartbeat (Ping)
            ping_count = 0
            disconnect_counter = 0
            # BUGFIX: Permitir hasta 3 ciclos sin _is_client_connected() antes de matar el stream
            # para evitar cierres prematuros por latencia en el reporte de plantas
            while self.connected:
                if not self._is_client_connected():
                    disconnect_counter += 1
                    if disconnect_counter >= 3:
                        logging.warning(f"[RITHMIC] stream_data para {symbol}: cliente desconectado tras 3 intentos")
                        break
                    await asyncio.sleep(1)
                    continue
                else:
                    disconnect_counter = 0

                await asyncio.sleep(1)
                ping_count += 1
                if ping_count >= 5: # Enviar status cada 5 segundos para mantener vivo el socket
                    try:
                        await callback({
                            "type": "status_update", 
                            "source": "rithmic", 
                            "connected": True, 
                            "ping": True
                        })
                    except Exception:
                        break
                    ping_count = 0
                    
        except Exception as e:
            if str(e) == "ClientDisconnected":
                logging.info(f"[RITHMIC] Cliente frontend desconectado limpiamente de {symbol}.")
                raise e # Propagar a main.py
            logging.error(f"[RITHMIC] Error fatal en stream_data para {symbol}: {e}")
        finally:


            # Limpieza segura
            logging.info(f"[RITHMIC] Finalizando stream para {symbol}")

            if symbol not in self._subscribers: # Usamos el original para buscar
                 pass # En realidad subscribimos por target_symbol
            
            # Busqueda y eliminacion en todos los canales por si acaso
            for sym in list(self._subscribers.keys()):
                if callback in self._subscribers[sym]:
                    self._subscribers[sym].remove(callback)
                    logging.info(f"[RITHMIC] Suscriptor WS eliminado para {sym}")
                    # Si ya no hay suscriptores, limpiar el book acumulado
                    if not self._subscribers[sym]:
                        self._order_books.pop(sym, None)
                        self._last_heatmap_ts.pop(sym, None)
                        logging.info(f"[RITHMIC] Book acumulado limpiado para {sym}")

    async def _broadcast(self, symbol, message):
        """Envía un mensaje a todos los suscriptores de un símbolo de forma segura."""
        if symbol not in self._subscribers:
            logging.warning(f"[RITHMIC] _broadcast: no hay suscriptores para {symbol}")
            return
            
        subscriber_count = len(self._subscribers[symbol])
        logging.info(f"[RITHMIC] _broadcast: enviando {message.get('type', 'unknown')} a {subscriber_count} suscriptor(es) de {symbol}")
        
        success_count = 0
        for cb in list(self._subscribers[symbol]):
            try:
                await asyncio.wait_for(cb(message), timeout=0.5)
                success_count += 1
            except Exception as e:
                logging.debug(f"[RITHMIC] _broadcast fallo para {symbol}: {e}")
        
        if success_count > 0:
            logging.info(f"[RITHMIC] _broadcast: {success_count}/{subscriber_count} mensajes enviados exitosamente")

    async def _on_tick_received(self, data):
        """
        Procesa ticks L1 (template 150=LastTrade, 151=BBO).
        La librería async_rithmic pasa data como DICT via _response_to_dict().
        Campos disponibles: symbol, exchange, last_trade_price, last_trade_size,
                            best_bid_price, best_ask_price, data_type, datetime
        """
        try:
            # BUGFIX: Usar INFO para poder debuggear en producción (el root logger está en INFO)
            logging.info(f"[RITHMIC] TICK recibido: type={type(data)}, keys={list(data.keys()) if isinstance(data, dict) else '?'}")

            # data SIEMPRE llega como dict en template 150/151
            if not isinstance(data, dict):
                logging.warning(f"[RITHMIC] TICK formato inesperado: {type(data)}")
                return

            # 1. Mapeo de símbolo
            r_symbol = data.get('symbol')
            # BUGFIX: Manejar symbol@exchange igual que en _on_order_book_received
            if r_symbol and '@' in r_symbol:
                r_symbol = r_symbol.split('@')[0]
            symbol   = self._rithmic_to_ext.get(r_symbol)
            if not symbol and len(self._subscribers) == 1:
                symbol = next(iter(self._subscribers))
            if not symbol or symbol not in self._subscribers:
                logging.info(f"[RITHMIC] TICK descartado: sin mapeo para r_symbol={r_symbol}, subscribers={list(self._subscribers.keys())}")
                return

            # 2. Extraer BBO (Actualizar memoria de BBO para detectar agresiones)
            best_bid = data.get('best_bid_price')
            best_ask = data.get('best_ask_price')
            
            if best_bid or best_ask:
                if symbol not in self._last_bbo:
                    self._last_bbo[symbol] = {'bid': 0.0, 'ask': 0.0}
                if best_bid: self._last_bbo[symbol]['bid'] = float(best_bid)
                if best_ask: self._last_bbo[symbol]['ask'] = float(best_ask)

            # 3. Extraer precio de trade y volumen
            price = data.get('last_trade_price') or data.get('trade_price')
            volume = data.get('last_trade_size') or data.get('trade_size') or 0
            
            if price is None:
                # Si es un tick solo de BBO, emitimos sin volumen solo para actualizar el precio actual
                if best_bid or best_ask:
                    mid_price = (best_bid + best_ask) / 2 if (best_bid and best_ask) else (best_bid or best_ask)
                    await self._broadcast(symbol, {
                        "type": "price_update",
                        "symbol": symbol,
                        "price": float(mid_price),
                        "volume": 0,
                        "time": int(data.get('datetime').timestamp() if data.get('datetime') else __import__('time').time()),
                        "source": "rithmic"
                    })
                return

            # 4. Determinar SIDE (Agresión) - Lógica de Prioridad Pugobot
            side = "unknown"
            bbo = self._last_bbo.get(symbol)
            
            # Prioridad 1: Comparación contra el Spread (BBO)
            if bbo and bbo['ask'] > 0 and bbo['bid'] > 0:
                if float(price) >= bbo['ask']:
                    side = "buy"
                elif float(price) <= bbo['bid']:
                    side = "sell"
            
            # Prioridad 2: Tick Rule (Comparación con el precio anterior) como fallback radical
            if side == "unknown":
                last_p = getattr(self, f"_last_p_{symbol}", 0)
                if last_p > 0:
                    if float(price) > last_p: side = "buy"
                    elif float(price) < last_p: side = "sell"
                    else:
                        # Si es igual, hereda la agresión del anterior (Tick Rule estándar)
                        side = getattr(self, f"_last_side_{symbol}", "buy")
            
            # Guardar estado para el próximo tick
            setattr(self, f"_last_p_{symbol}", float(price))
            setattr(self, f"_last_side_{symbol}", side)

            logging.info(f"[RITHMIC] Trade detectado -> {symbol}: {price} vol={volume} agresión={side}")

            # 4. Enviar Actualización de Precio (Para velas y UI)
            price_msg = {
                "type": "price_update",
                "symbol": symbol,
                "price": float(price),
                "volume": int(volume),
                "side": side,
                "time": int(data.get('datetime').timestamp() if data.get('datetime') else __import__('time').time()),
                "source": "rithmic"
            }
            await self._broadcast(symbol, price_msg)

            # 5. Enviar Big Trade (Para motor de burbujas de Bookmap)
            if volume > 0:
                big_trade_msg = {
                    "type": "big_trade",
                    "symbol": symbol,
                    "price": float(price),
                    "size": int(volume),
                    "side": side, # buy / sell / unknown
                    "time": price_msg["time"]
                }
                await self._broadcast(symbol, big_trade_msg)

        except Exception as e:
            logging.error(f"[RITHMIC] Error en tick: {e}", exc_info=True)

    async def _on_order_book_received(self, data):
        """
        Procesa libro de ordenes para HEATMAP (L2) — template 156.
        La librería async_rithmic pasa el OBJETO PROTOBUF CRUDO (no dict).
        Rithmic envía:
          - SNAPSHOT_IMAGE (3): Book completo inicial
          - BEGIN/MIDDLE/END (4/5/6) o SOLO (7): Cambio de 1 nivel (incremental)
        Estrategia: acumulamos todo en self._order_books[symbol] y emitimos
        el snapshot COMPLETO a 2 fps para que el heatmap 2D tenga todos los niveles.
        """
        try:
            # 1. Obtener símbolo del protobuf
            r_symbol = getattr(data, 'symbol', None)
            if not r_symbol and isinstance(data, dict):
                r_symbol = data.get('symbol')

            # 2. Mapeo al símbolo externo (Normalizado)
            symbol = self._rithmic_to_ext.get(r_symbol)
            if not symbol:
                # Intentar sin exchange (NQ@CME -> NQ)
                base = r_symbol.split('@')[0] if '@' in r_symbol else r_symbol
                symbol = self._rithmic_to_ext.get(base)

            if not symbol and len(self._subscribers) == 1:
                symbol = next(iter(self._subscribers))
            
            if not symbol:
                return

            # 3. Inicializar book acumulado si no existe
            if symbol not in self._order_books:
                self._order_books[symbol] = {}

            book = self._order_books[symbol]

            # 4. Ver tipo de actualizaón
            update_type = getattr(data, 'update_type', None)

            # CLEAR_ORDER_BOOK (1) o NO_BOOK (2) - limpiar el book
            if update_type in (1, 2):
                book.clear()
                return

            # Aplicar los niveles del mensaje al book acumulado
            for side in ['bid', 'ask']:
                prices = list(getattr(data, f'{side}_price', []))
                sizes  = list(getattr(data, f'{side}_size',  []))
                for p, s in zip(prices, sizes):
                    if p and p > 0:
                        key = f"{p:.4f}"
                        if s == 0:
                            book.pop(key, None)  # Nivel retirado
                        else:
                            book[key] = {'p': float(p), 's': int(s)}

            # 5. Throttle: max 2 snapshots/segundo
            now     = __import__('time').time()
            last_ts = self._last_heatmap_ts.get(symbol, 0)
            if now - last_ts < 0.5:
                return
            self._last_heatmap_ts[symbol] = now

            # 6. Throttle y Recorte de Heatmap (Solo enviar precios cercanos para ahorrar ancho de banda)
            current_p = getattr(self, f"_last_p_{symbol}", 0)
            heatmap_rows = []
            if current_p > 0:
                # Solo enviar niveles a +/- 50 puntos del precio actual
                margin = 50.0 
                heatmap_rows = [v for v in book.values() if abs(v['p'] - current_p) <= margin]
            else:
                heatmap_rows = list(book.values())[:300] # Fallback si no hay precio
            
            if not heatmap_rows:
                return

            logging.info(f"[RITHMIC] Heatmap optimizado -> {symbol}: {len(heatmap_rows)} niveles (de {len(book)} totales)")

            # 7. Guardar en Historial y Emitir el book COMPLETO acumulado
            snapshot = {
                "type": "heatmap",
                "symbol": str(symbol),
                "data": heatmap_rows,
                "time": int(now)
            }

            # Guardar en buffer circular (historial de últimas ~10 min)
            if symbol not in self._heatmap_histories:
                self._heatmap_histories[symbol] = deque(maxlen=1000)
            self._heatmap_histories[symbol].append(snapshot)

            await self._broadcast(symbol, snapshot)

        except Exception as e:
            logging.error(f"[RITHMIC] Error en orderbook: {e}", exc_info=True)




    def get_last_price(self, symbol):
        """Retorna el ultimo precio conocido para un simbolo (mapeado si es necesario)."""
        # Intentar con el simbolo original y con el mapeado
        p = getattr(self, f"_last_p_{symbol}", None)
        if p is not None: return p
        
        # Si no lo encuentra, buscar en el mapa de rithmic_to_ext a la inversa
        for r_sym, ext_sym in self._rithmic_to_ext.items():
            if ext_sym == symbol:
                p = getattr(self, f"_last_p_{r_sym}", None)
                if p is not None: return p
        
        return None

    async def disconnect(self):
        """Cierra la sesion maestra."""
        async with self._lock:
            if self._client:
                try: await self._client.disconnect()
                except: pass
                self._client = None
                self.connected = False
                self.running = False
                self._subscribed_symbols.clear()
                self._subscribers.clear()
                logging.info("[RITHMIC] SESION MAESTRA CERRADA")

rithmic_service = RithmicService()

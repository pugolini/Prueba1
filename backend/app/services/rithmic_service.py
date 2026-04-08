import asyncio
import logging
import json
import os
from datetime import datetime
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
            # Opción A: tiene plantas (ticker, history, etc)
            if hasattr(self._client, 'plants') and self._client.plants:
                return any(getattr(p, 'is_connected', False) for p in self._client.plants.values())
            
            # Opción B: fallback al socket interno si existe
            if hasattr(self._client, 'ws') and self._client.ws:
                return not self._client.ws.closed
                
            return self.connected
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
            while self.connected and self._is_client_connected():
                await asyncio.sleep(1)
                ping_count += 1
                if ping_count >= 5: # Enviar status cada 5 segundos para mantener vivo el socket
                    await callback({
                        "type": "status_update", 
                        "source": "rithmic", 
                        "connected": True, 
                        "ping": True
                    })
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
        if symbol in self._subscribers:
            for cb in list(self._subscribers[symbol]):
                try:
                    await asyncio.wait_for(cb(message), timeout=0.5)
                except:
                    pass

    async def _on_tick_received(self, data):
        """
        Procesa ticks L1 (template 150=LastTrade, 151=BBO).
        La librería async_rithmic pasa data como DICT via _response_to_dict().
        Campos disponibles: symbol, exchange, last_trade_price, last_trade_size,
                            best_bid_price, best_ask_price, data_type, datetime
        """
        try:
            logging.debug(f"[RITHMIC] TICK recibido: type={type(data)}, keys={list(data.keys()) if isinstance(data, dict) else '?'}")

            # data SIEMPRE llega como dict en template 150/151
            if not isinstance(data, dict):
                logging.warning(f"[RITHMIC] TICK formato inesperado: {type(data)}")
                return

            # 1. Mapeo de símbolo
            r_symbol = data.get('symbol')
            symbol   = self._rithmic_to_ext.get(r_symbol)
            if not symbol and len(self._subscribers) == 1:
                symbol = next(iter(self._subscribers))
            if not symbol or symbol not in self._subscribers:
                return

            # 2. Extraer precio (LastTrade tiene last_trade_price, BBO tiene best_bid/ask)
            price = (data.get('last_trade_price') or
                     data.get('best_bid_price') or
                     data.get('best_ask_price'))
            if price is None:
                return

            volume = data.get('last_trade_size') or data.get('trade_size') or 0

            logging.debug(f"[RITHMIC] Tick -> {symbol}: {price} vol={volume}")

            await self._broadcast(symbol, {
                "type": "price_update",
                "symbol": symbol,
                "price": float(price),
                "volume": int(volume),
                "time": int(data.get('datetime').timestamp() if data.get('datetime') else __import__('time').time()),
                "source": "rithmic"
            })

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

            # 6. Emitir el book COMPLETO acumulado
            heatmap_rows = list(book.values())
            if not heatmap_rows:
                return

            logging.info(f"[RITHMIC] Heatmap snapshot -> {symbol}: {len(heatmap_rows)} niveles totales")

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

import MetaTrader5 as mt5
import pandas as pd
import asyncio
from typing import List, Optional, Dict
import logging
from datetime import datetime

# Configuración de logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("MT5Service")

class MT5Service:
    _instance = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(MT5Service, cls).__new__(cls)
            cls._instance.initialized = False
        return cls._instance

    def initialize(self):
        """Inicializa la conexión a MT5 si no está ya activa."""
        if self.initialized:
            # Verificar si la conexión sigue viva realmente
            terminal_info = mt5.terminal_info()
            if terminal_info is not None:
                return True
            else:
                logger.warning("Conexión perdida, intentando reinicializar...")
                self.initialized = False

        # Ruta específica solicitada por el usuario para Axi MetaTrader 5
        path = r"C:\Program Files\Axi MetaTrader 5 Terminal\terminal64.exe"
        if not mt5.initialize(path=path):
            logger.error(f"Error al inicializar MT5 en {path}: {mt5.last_error()}")
            # Intento de respaldo estándar
            if not mt5.initialize():
                logger.error(f"Fallo total al inicializar MT5: {mt5.last_error()}")
                return False
        
        logger.info(f"MT5 Inicializado con éxito (Instancia: {path})")
        self.initialized = True
        return True

    def get_historical_data(self, symbol: str, timeframe: int, count: int = 500):
        """
        Extrae velas históricas de MT5.
        Timeframes: mt5.TIMEFRAME_M1, M5, M15, etc.
        """
        if not self.initialized:
            self.initialize()

        # Asegurar que el símbolo esté seleccionado en el Market Watch
        if not mt5.symbol_select(symbol, True):
            logger.error(f"No se pudo seleccionar el símbolo {symbol}: {mt5.last_error()}")
            return []

        # Obtener rates
        rates = mt5.copy_rates_from_pos(symbol, timeframe, 0, count)
        if rates is None:
            logger.error(f"No se pudieron obtener datos históricos para {symbol}: {mt5.last_error()}")
            return []

        # Convertir a DataFrame y formatear para lightweight-charts
        df = pd.DataFrame(rates)
        df['time'] = df['time'].astype(int) # Unix timestamp
        
        # lightweight-charts espera {time, open, high, low, close}
        # En MT5: (time, open, high, low, close, tick_volume, spread, real_volume)
        result = df[['time', 'open', 'high', 'low', 'close', 'tick_volume']].to_dict('records')
        return result

    def get_last_tick(self, symbol: str):
        if not self.initialized:
            self.initialize()
            
        if not mt5.symbol_select(symbol, True):
            return None
            
        tick = mt5.symbol_info_tick(symbol)
        if tick is None:
            return None
        
        return {
            "time": int(tick.time),
            "bid": tick.bid,
            "ask": tick.ask,
            "last": tick.last,
            "volume": tick.volume,
            "flags": tick.flags
        }

    def get_ticks_range(self, symbol: str, start_time: int, count: int = 1000):
        """
        Obtiene una ráfaga de ticks para el cálculo del footprint.
        """
        if not self.initialized: self.initialize()
        
        # MT5 copy_ticks_from espera segundos (int). Si enviamos decimales, redondea.
        # Estrategia robusta: Pedimos desde el segundo actual y filtramos por milisegundos.
        # Margen de seguridad: Pedimos desde 1 segundo antes para compensar desincronizaciones de reloj,
        # el filtrado posterior por t.time_msc > start_time asegura la unicidad de los datos.
        start_time_s = (start_time / 1000.0) - 1.0 
        ticks = mt5.copy_ticks_from(symbol, start_time_s, 2000, mt5.COPY_TICKS_ALL)
        
        if ticks is None or len(ticks) == 0:
            return []
            
        result = []
        for t in ticks:
            # Acceso ultra-robusto a numpy.void/tupla estructurada de MT5
            try:
                # Intentamos acceso por atributo
                t_time = t.time_msc
                t_bid = t.bid
                t_ask = t.ask
                t_last = t.last
                t_vol = t.volume
                t_flags = t.flags
            except AttributeError:
                # Fallback institucional: Acceso por nombre de campo
                t_time = t['time_msc']
                t_bid = t['bid']
                t_ask = t['ask']
                t_last = t['last']
                t_vol = t['volume']
                t_flags = t['flags']

            # Solo añadimos ticks que sean estrictamente posteriores a nuestro último puntero (en ms)
            if t_time > start_time:
                result.append({
                    "time": int(t_time),
                    "bid": float(t_bid),
                    "ask": float(t_ask),
                    "last": float(t_last),
                    "volume": float(t_vol),
                    "flags": int(t_flags),
                    "price": float(t_last if t_last > 0 else (t_bid if t_bid > 0 else t_ask))
                })
        
        return result

    async def send_order(self, symbol: str, order_type: str, lot: float, price: float = 0, sl: float = 0, tp: float = 0):
        """
        Ejecuta una orden en MT5 con reintentos de filling dinámicos.
        order_type: 'BUY', 'SELL', 'BUY_LIMIT', 'SELL_LIMIT'
        """
        if not self.initialized:
            self.initialize()

        # Mapeo de tipos de orden
        types = {
            'BUY': mt5.ORDER_TYPE_BUY,
            'SELL': mt5.ORDER_TYPE_SELL,
            'BUY_LIMIT': mt5.ORDER_TYPE_BUY_LIMIT,
            'SELL_LIMIT': mt5.ORDER_TYPE_SELL_LIMIT
        }

        # Determinamos precio para órdenes a mercado si no se provee
        if price <= 0 and 'LIMIT' not in order_type:
            tick = mt5.symbol_info_tick(symbol)
            if not tick: return {"status": "error", "message": "No tick data for symbol"}
            price = tick.ask if order_type == 'BUY' else tick.bid

        # Lista de tipos de filling para probar
        filling_types = [
            mt5.ORDER_FILLING_IOC,
            mt5.ORDER_FILLING_FOK,
            mt5.ORDER_FILLING_RETURN
        ]

        last_error = ""
        for filling in filling_types:
            request = {
                "action": mt5.TRADE_ACTION_DEAL if 'LIMIT' not in order_type else mt5.TRADE_ACTION_PENDING,
                "symbol": symbol,
                "volume": lot,
                "type": types.get(order_type),
                "price": price,
                "magic": 123456,
                "comment": "Pugobot Order",
                "type_time": mt5.ORDER_TIME_GTC,
                "type_filling": filling,
            }

            if sl > 0: request["sl"] = sl
            if tp > 0: request["tp"] = tp

            logger.info(f"== [MT5] Intentando orden {order_type} con filling {filling} ==")
            result = mt5.order_send(request)

            if result and result.retcode == mt5.TRADE_RETCODE_DONE:
                logger.info(f"== [MT5] Orden COMPLETADA con éxito: Ticket {result.order} ==")
                return {
                    "status": "success",
                    "ticket": result.order,
                    "retcode": result.retcode,
                    "comment": result.comment
                }
            else:
                last_error = f"{result.comment} (code: {result.retcode})" if result else "No message"
                logger.warning(f"Error con filling {filling}: {last_error}")

        logger.error(f"Falla total tras probar todos los filling: {last_error}")
        return {"status": "error", "message": last_error}

    def get_market_status(self, symbol: str):
        """
        Determina si el mercado para un símbolo está abierto.
        """
        if not self.initialized:
            self.initialize()
        
        info = mt5.symbol_info(symbol)
        if info is None:
            return False
            
        # 1. Filtro de Fin de Semana (Sábado=5, Domingo=6)
        # La mayoría de índices y forex cierran el fin de semana. 
        # Cripto (BTC, ETH) suele estar abierto 24/7.
        now = datetime.now()
        is_crypto = any(x in symbol.upper() for x in ["BTC", "ETH", "SOL", "LTC"])
        
        if now.weekday() >= 5 and not is_crypto:
            return False

        # 2. Filtro de Inactividad (Ticks)
        # Si no hay ticks en los últimos 60 minutos, el mercado está probablemente cerrado.
        tick = mt5.symbol_info_tick(symbol)
        if tick:
            diff_seconds = now.timestamp() - tick.time
            if diff_seconds > 3600: # 1 Hora
                return False

        # 3. Filtro de Modo de Trading
        return info.trade_mode == mt5.SYMBOL_TRADE_MODE_FULL

    def get_positions(self, symbol: str):
        """Obtiene las posiciones abiertas filtradas por símbolo."""
        if not self.initialized: self.initialize()
        positions = mt5.positions_get(symbol=symbol)
        if positions is None: return []
        
        result = []
        for p in positions:
            result.append({
                "ticket": p.ticket,
                "symbol": p.symbol,
                "type": "BUY" if p.type == mt5.POSITION_TYPE_BUY else "SELL",
                "volume": p.volume,
                "price_open": p.price_open,
                "sl": p.sl,
                "tp": p.tp,
                "profit": p.profit,
                "comment": p.comment
            })
        return result

    def get_orders(self, symbol: str):
        """Obtiene las órdenes pendientes filtradas por símbolo."""
        if not self.initialized: self.initialize()
        orders = mt5.orders_get(symbol=symbol)
        if orders is None: return []
        
        result = []
        for o in orders:
            result.append({
                "ticket": o.ticket,
                "symbol": o.symbol,
                "type": "BUY_LIMIT" if o.type == mt5.ORDER_TYPE_BUY_LIMIT else 
                        ("SELL_LIMIT" if o.type == mt5.ORDER_TYPE_SELL_LIMIT else "OTHER"),
                "volume": o.volume_initial,
                "price_open": o.price_open,
                "sl": o.sl,
                "tp": o.tp,
                "comment": o.comment
            })
        return result

    async def modify_order(self, ticket: int, sl: float = 0, tp: float = 0, price: float = 0):
        """Modifica SL, TP o Precio de una posición u orden pendiente."""
        if not self.initialized: self.initialize()
        
        # Primero intentamos como POSICIÓN activa (SL/TP)
        pos = mt5.positions_get(ticket=ticket)
        if pos and len(pos) > 0:
            p = pos[0]
            request = {
                "action": mt5.TRADE_ACTION_SLTP,
                "symbol": p.symbol,
                "position": ticket,
                "sl": sl if sl > 0 else p.sl,
                "tp": tp if tp > 0 else p.tp,
            }
            result = mt5.order_send(request)
            return result._asdict() if result else {"error": "Fail to modify position"}

        # Si no es posición, intentamos como ORDEN pendiente
        ord = mt5.orders_get(ticket=ticket)
        if ord and len(ord) > 0:
            o = ord[0]
            request = {
                "action": mt5.TRADE_ACTION_MODIFY,
                "order": ticket,
                "symbol": o.symbol,
                "price": price if price > 0 else o.price_open,
                "sl": sl if sl > 0 else o.sl,
                "tp": tp if tp > 0 else o.tp,
                "type_time": o.type_time,
                "type_filling": o.type_filling
            }
            result = mt5.order_send(request)
            return result._asdict() if result else {"error": "Fail to modify order"}

        return {"error": "Ticket not found"}

    async def close_position(self, ticket: int):
        """Cierra una posición abierta al mercado."""
        if not self.initialized: self.initialize()
        pos = mt5.positions_get(ticket=ticket)
        if not pos or len(pos) == 0:
            # Si no es posición, probamos si es orden pendiente para cancelarla
            ord = mt5.orders_get(ticket=ticket)
            if ord and len(ord) > 0:
                request = {
                    "action": mt5.TRADE_ACTION_REMOVE,
                    "order": ticket
                }
                result = mt5.order_send(request)
                return result._asdict() if result else {"error": "Fail to remove order"}
            return {"error": "Ticket not found"}

        p = pos[0]
        tick = mt5.symbol_info_tick(p.symbol)
        
        request = {
            "action": mt5.TRADE_ACTION_DEAL,
            "symbol": p.symbol,
            "volume": p.volume,
            "type": mt5.ORDER_TYPE_SELL if p.type == mt5.POSITION_TYPE_BUY else mt5.ORDER_TYPE_BUY,
            "position": ticket,
            "price": tick.bid if p.type == mt5.POSITION_TYPE_BUY else tick.ask,
            "magic": p.magic,
            "comment": "Close from Pugobot",
            "type_time": mt5.ORDER_TIME_GTC,
            "type_filling": mt5.ORDER_FILLING_IOC,
        }
        result = mt5.order_send(request)
        return result._asdict() if result else {"error": "Fail to close position"}

    def get_history(self, symbol: str, days: int = 7):
        """Obtiene las operaciones cerradas (deals) del historial de los últimos días."""
        if not self.initialized: self.initialize()
        
        # Calcular rango de tiempo
        import time
        from_date = int(time.time()) - (days * 86400)
        to_date = int(time.time()) + 86400 # Hasta mañana para asegurar
        
        # Normalizar símbolo para el filtrado de grupo si es necesario
        # group=f"*{symbol}*" ayuda a filtrar en brokers con sufijos
        deals = mt5.history_deals_get(from_date, to_date, group=f"*{symbol.split('.')[0]}*")
        
        if deals is None or len(deals) == 0:
            return []
            
        result = []
        for d in deals:
            # Solo deals que sean cierres (DEAL_ENTRY_OUT) o transacciones reales
            # d.type 0: BUY, 1: SELL
            result.append({
                "ticket": d.order,
                "symbol": d.symbol,
                "type": "BUY" if d.type == mt5.DEAL_TYPE_BUY else "SELL",
                "volume": d.volume,
                "price": d.price,
                "profit": d.profit,
                "time": d.time,
                "comment": d.comment,
                "entry": "IN" if d.entry == mt5.DEAL_ENTRY_IN else ("OUT" if d.entry == mt5.DEAL_ENTRY_OUT else "INOUT")
            })
            
        # Ordenar por tiempo descendente (más recientes primero)
        result.sort(key=lambda x: x['time'], reverse=True)
        return result

    def get_account_info(self):
        """Obtiene información de balance, equidad y margen de la cuenta."""
        if not self.initialized: self.initialize()
        acc = mt5.account_info()
        if acc is None: return None
        
        return {
            "balance": acc.balance,
            "equity": acc.equity,
            "margin_free": acc.margin_free,
            "profit": acc.profit,
            "leverage": acc.leverage,
            "currency": acc.currency
        }

    def get_connection_info(self, symbol: str):
        """
        Devuelve el estado de la conexión y del mercado.
        """
        if not self.initialized:
            connected = self.initialize()
        else:
            connected = True
            
        market_open = self.get_market_status(symbol) if connected else False
        server_time = datetime.now().strftime("%H:%M:%S")
        
        return {
            "mt5_connected": connected,
            "market_open": market_open,
            "server_time": server_time,
            "symbol": symbol
        }

    def shutdown(self):

        mt5.shutdown()
        self.initialized = False

# Singleton instance
mt5_service = MT5Service()

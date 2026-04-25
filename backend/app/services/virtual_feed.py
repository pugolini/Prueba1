import asyncio
import random
import time
import math

class VirtualFeed:
    """Generador de datos de mercado simulado para el símbolo DEMO."""
    
    def __init__(self):
        self.base_price = 5000.0
        self.tick_size = 0.25
        self.volatility = 2.5
        self.trend = 0.0
        self.history = []
        
        # Generar historial inicial inmediatamente para consistencia
        self._initialize_history(2880)
        
    def _initialize_history(self, count):
        """Genera el historial inicial de 2 días."""
        price = 5000.0
        now = int(time.time())
        # Alineamos el inicio a un múltiplo de 60s
        start_time = (math.floor(now / 60) - count) * 60
        
        for i in range(count):
            candle_time = start_time + i * 60
            ohlc = self._generate_ohlc(price)
            ohlc["time"] = candle_time
            self.history.append(ohlc)
            price = ohlc["close"]
        
        self.base_price = price
        self.last_candle_time = (math.floor(now / 60)) * 60
        
    def _generate_ohlc(self, start_price, timeframe_mins=1):
        """Genera una vela OHLC realista basada en el precio inicial."""
        # Caminata aleatoria para el cierre con inercia
        self.trend += random.gauss(0, 0.1)
        self.trend = max(-0.8, min(0.8, self.trend))
        
        change = random.gauss(self.trend * 2, self.volatility)
        close_price = start_price + round(change / self.tick_size) * self.tick_size
        
        # Mechas realistas (relativas al cuerpo)
        body_size = abs(close_price - start_price)
        wick_noise = self.volatility * 0.4
        
        high = max(start_price, close_price) + round(random.uniform(0, wick_noise) / self.tick_size) * self.tick_size
        low = min(start_price, close_price) - round(random.uniform(0, wick_noise) / self.tick_size) * self.tick_size
        
        return {
            "open": round(start_price, 2),
            "high": round(high, 2),
            "low": round(low, 2),
            "close": round(close_price, 2),
            "tick_volume": random.randint(100, 800)
        }

    def get_history(self, count=2880):
        """Devuelve historial consistente."""
        return self.history[-count:]

    def _update_history_with_live(self):
        """Actualiza el historial con una nueva vela si ha pasado un minuto."""
        now = int(time.time())
        current_candle_time = (math.floor(now / 60)) * 60
        
        if current_candle_time > self.last_candle_time:
            # Creamos una vela basada en el movimiento del último minuto
            # Para simplificar, usamos el base_price actual que ya movieron los ticks
            new_ohlc = self._generate_ohlc(self.history[-1]["close"])
            new_ohlc["time"] = self.last_candle_time
            self.history.append(new_ohlc)
            self.history = self.history[-5000:] # Mantener buffer razonable
            self.last_candle_time = current_candle_time
            print(f"[VirtualFeed] Nueva vela añadida al historial: {new_ohlc['close']}")

    def _move_price(self):
        """Mueve el base_price basado en la tendencia y volatilidad."""
        self._update_history_with_live() # Asegurar sincronía
        self.trend += random.gauss(0, 0.05)
        self.trend = max(-0.5, min(0.5, self.trend))
        change = random.gauss(self.trend, self.volatility * 0.2) # Menor volatilidad por tick
        self.base_price += round(change / self.tick_size) * self.tick_size
        self.base_price = round(self.base_price, 2)
        return self.base_price

    async def generate_tick_burst(self):
        """Genera una ráfaga de ticks con distribución realista."""
        ticks = []
        count = random.randint(3, 8)
        now = int(time.time() * 1000)
        
        for _ in range(count):
            price = self._move_price()
            side = 'buy' if random.random() > 0.48 else 'sell'  # Ligero sesgo comprador
            quantity = random.choices(
                [1, 2, 5, 10, 25, 50],
                weights=[40, 25, 15, 10, 7, 3],
                k=1
            )[0]
            
            ticks.append({
                "time": now,
                "price": price,
                "quantity": quantity,
                "side": side,
                "aggressor": 1 if side == 'buy' else 2
            })
            now += random.randint(5, 100)
            
        return {"type": "tick_burst", "data": ticks}

    async def generate_heatmap(self):
        """Genera niveles de liquidez simulados alrededor del precio actual."""
        data = {}
        for i in range(-15, 15):
            price = round((self.base_price + i * self.tick_size) / self.tick_size) * self.tick_size
            # Más liquidez cerca del precio, menos lejos
            distance_factor = max(1, abs(i))
            size = random.randint(20, 200) // distance_factor
            if size > 5:
                data[str(price)] = size
        return {"type": "heatmap", "data": data}

    async def stream_data(self, symbol, send_callback):
        """Bucle principal de streaming de datos simulados."""
        print(f"[VirtualFeed] Iniciando flujo para {symbol}")
        
        iteration = 0
        while True:
            # Ráfaga de ticks normal
            burst = await self.generate_tick_burst()
            await send_callback(burst)
            
            # Heatmap cada 5 iteraciones
            if iteration % 5 == 0:
                hm = await self.generate_heatmap()
                await send_callback(hm)
                
            # Heartbeat cada 10 iteraciones
            if iteration % 10 == 0:
                await send_callback({
                    "type": "heartbeat",
                    "symbol": symbol,
                    "time": int(time.time()),
                    "price": self.base_price,
                    "bid": self.base_price - self.tick_size,
                    "ask": self.base_price + self.tick_size
                })
                
            iteration += 1
            await asyncio.sleep(0.15)

virtual_feed = VirtualFeed()

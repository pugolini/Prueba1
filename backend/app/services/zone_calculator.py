"""
Session Zones Calculator — Calcula las zonas institucionales clave.

Zonas calculadas (basadas en Módulos 4.1, 4.2, 6.1 de Adrianus Playbook):
  - POC del día anterior (Point of Control)
  - VAH del día anterior (Value Area High)
  - VAL del día anterior (Value Area Low)
  - Previous Day High / Low
  - Initial Balance High / Low (primeros 60 min de sesión)
  - Overnight High / Low
  - Gap RTH (diferencia entre cierre anterior y apertura actual)
"""

import math
import logging
import pandas as pd
from datetime import datetime, timezone
from typing import List, Dict, Optional


def calculate_volume_profile(candles: List[Dict], tick_size: float = 0.25, value_area_pct: float = 0.70, return_histogram: bool = False) -> Dict:
    """
    Calcula POC, VAH y VAL a partir de un conjunto de velas.
    
    Distribuye el volumen de cada vela uniformemente entre sus rangos de precio,
    luego aplica el algoritmo estándar de Value Area (70% del volumen
    concentrado alrededor del POC).
    """
    if not candles:
        return {"poc": 0, "vah": 0, "val": 0}
    
    # Acumular volumen por nivel de precio
    volume_by_price: Dict[float, float] = {}
    
    for c in candles:
        high = c.get("high", 0)
        low = c.get("low", 0)
        vol = c.get("tick_volume", c.get("volume", 1))
        
        if high <= low or vol <= 0:
            continue
        
        # Discretizar en niveles de tick
        low_tick = math.floor(low / tick_size) * tick_size
        high_tick = math.ceil(high / tick_size) * tick_size
        num_levels = max(1, int(round((high_tick - low_tick) / tick_size)) + 1)
        vol_per_level = vol / num_levels
        
        price = low_tick
        for _ in range(num_levels):
            rounded_price = round(price, 4)
            volume_by_price[rounded_price] = volume_by_price.get(rounded_price, 0) + vol_per_level
            price += tick_size
    
    if not volume_by_price:
        return {"poc": 0, "vah": 0, "val": 0}
    
    # POC = precio con mayor volumen
    poc = max(volume_by_price, key=volume_by_price.get)
    total_volume = sum(volume_by_price.values())
    target_volume = total_volume * value_area_pct
    
    # Ordenar precios
    sorted_prices = sorted(volume_by_price.keys())
    poc_idx = sorted_prices.index(poc)
    
    # Expandir desde POC hacia arriba y abajo hasta cubrir 70%
    accumulated = volume_by_price[poc]
    low_idx = poc_idx
    high_idx = poc_idx
    
    while accumulated < target_volume and (low_idx > 0 or high_idx < len(sorted_prices) - 1):
        # Volumen arriba vs abajo
        vol_above = volume_by_price.get(sorted_prices[min(high_idx + 1, len(sorted_prices) - 1)], 0) if high_idx < len(sorted_prices) - 1 else 0
        vol_below = volume_by_price.get(sorted_prices[max(low_idx - 1, 0)], 0) if low_idx > 0 else 0
        
        if vol_above >= vol_below and high_idx < len(sorted_prices) - 1:
            high_idx += 1
            accumulated += volume_by_price[sorted_prices[high_idx]]
        elif low_idx > 0:
            low_idx -= 1
            accumulated += volume_by_price[sorted_prices[low_idx]]
        elif high_idx < len(sorted_prices) - 1:
            high_idx += 1
            accumulated += volume_by_price[sorted_prices[high_idx]]
        else:
            break
    
    vah = sorted_prices[high_idx]
    val = sorted_prices[low_idx]
    
    result = {
        "poc": round(poc, 2),
        "vah": round(vah, 2),
        "val": round(val, 2)
    }

    if return_histogram:
        # Histograma de alta definición — enviar hasta 500 niveles al frontend
        # Para NAS100 (~1600 niveles nativos), esto da barras de ~0.8 pts cada una
        num_levels = len(sorted_prices)
        if num_levels > 500:
            step = max(1, num_levels // 500)
            binned_hist = []
            for i in range(0, num_levels, step):
                chunk = sorted_prices[i:i+step]
                avg_price = sum(chunk) / len(chunk)
                total_vol = sum(volume_by_price[p] for p in chunk)
                binned_hist.append({"price": round(avg_price, 2), "volume": round(total_vol, 2)})
            result["histogram"] = binned_hist
        else:
            # Sin binning — resolución nativa tick a tick
            result["histogram"] = [{"price": p, "volume": round(volume_by_price[p], 2)} for p in sorted_prices]

    return result


def calculate_session_zones(candles: List[Dict], tick_size: float = 0.25) -> Dict:
    """
    Calcula todas las zonas de sesión relevantes para la operativa.
    
    Recibe las velas de 1m de los últimos 2-3 días y calcula:
      - Perfil de volumen del día anterior (POC, VAH, VAL)
      - High/Low del día anterior
      - Initial Balance del día actual (primeros 60 min desde apertura NY 9:30)
      - Overnight High/Low (fuera de RTH)
      - Gap RTH
    """
    if not candles or len(candles) < 60:
        return {
            "prev_day": {"poc": 0, "vah": 0, "val": 0, "high": 0, "low": 0},
            "initial_balance": {"high": 0, "low": 0},
            "overnight": {"high": 0, "low": 0},
            "gap": {"size": 0, "direction": "none"},
            "bias": {"direction": "neutral", "confidence": 0}
        }
    
    # Separar velas por día (usando timestamp)
    from datetime import datetime, timezone
    
    days: Dict[str, List[Dict]] = {}
    for c in candles:
        ts = c.get("time", 0)
        # Usamos el timestamp tal cual viene del broker para agrupar por "día del broker"
        dt = datetime.fromtimestamp(ts, tz=timezone.utc)
        day_key = dt.strftime("%Y-%m-%d")
        if day_key not in days:
            days[day_key] = []
        days[day_key].append(c)
    
    # --- Normalización Temporal ---
    # Los datos recibidos ya vienen normalizados a UTC desde MT5Service.
    # Procedemos directamente a la conversión a Nueva York para identificar sesiones.
    df_all = pd.DataFrame(candles)
    latest_ny = None
    if not df_all.empty:
        try:
            df_all['dt_ny'] = pd.to_datetime(df_all['time'], unit='s', utc=True).dt.tz_convert('America/New_York')
            latest_ny = df_all['dt_ny'].iloc[-1]
        except Exception as e:
            logging.error(f"[ZoneCalculator] Error convirtiendo a NY: {e}")
            # Fallback: Usar hora UTC si falla el timezone (mejor que nada)
            df_all['dt_ny'] = pd.to_datetime(df_all['time'], unit='s', utc=True)
            latest_ny = df_all['dt_ny'].iloc[-1]
    
    sorted_days = sorted(days.keys())
    
    # --- Día anterior ---
    prev_day_candles = []
    current_day_candles = []
    
    if len(sorted_days) > 0:
        current_day_candles = days[sorted_days[-1]]
        if len(sorted_days) >= 2:
            prev_day_candles = days[sorted_days[-2]]
        else:
            # Fallback si solo hay un día: el POC previo será 0
            pass
    
    # Volume Profile del día anterior
    prev_vp = calculate_volume_profile(prev_day_candles, tick_size)
    
    # High/Low del día anterior
    prev_high = max(c.get("high", 0) for c in prev_day_candles) if prev_day_candles else 0
    prev_low = min(c.get("low", float('inf')) for c in prev_day_candles) if prev_day_candles else 0
    if prev_low == float('inf'):
        prev_low = 0
    
    # --- Initial Balance (Sesión Americana RTH: 09:30 - 10:30 NY) ---
    try:
        df_current = pd.DataFrame(current_day_candles)
        if not df_all.empty:
            # Filtro: 09:30 a 10:30 NY del día comercial actual
            mask_ib = (
                ((df_all['dt_ny'].dt.hour == 9) & (df_all['dt_ny'].dt.minute >= 30) & (df_all['dt_ny'].dt.date == latest_ny.date())) |
                ((df_all['dt_ny'].dt.hour == 10) & (df_all['dt_ny'].dt.minute < 30) & (df_all['dt_ny'].dt.date == latest_ny.date()))
            )
            ib_df = df_all[mask_ib]
            ib_candles = ib_df.to_dict('records')
        else:
            ib_candles = []
    except Exception as e:
        # Fallback si algo falla con el cálculo de NY
        ib_candles = current_day_candles[:60] if len(current_day_candles) >= 60 else current_day_candles
        
    ib_high = max(c.get("high", 0) for c in ib_candles) if ib_candles else 0
    ib_low = min(c.get("low", float('inf')) for c in ib_candles) if ib_candles else 0
    if ib_low == float('inf'):
        ib_low = 0
    
    # --- Overnight y RTH (Ya cargado arriba en df_all) ---
    on_candles = []
    rth_candles = []
    on_profile = {"poc": 0, "vah": 0, "val": 0, "histogram": []}
    rth_profile = {"poc": 0, "vah": 0, "val": 0, "histogram": []}
    on_high, on_low = 0, 0
    rth_df = pd.DataFrame()

    try:
        if not df_all.empty and latest_ny:
            # --- CÁLCULO DE SESIONES (UTC PURO) ---
            latest_ts = int(df_all['time'].max())
            dt_utc = datetime.utcfromtimestamp(latest_ts).replace(tzinfo=None)
            
            # Apertura NY (13:30 UTC = 09:30 NY en horario de verano)
            # En invierno es 14:30 UTC. Para ser dinámico:
            import pytz
            ny_tz = pytz.timezone('America/New_York')
            dt_ny = datetime.fromtimestamp(latest_ts, ny_tz)
            
            # Apertura NY hoy (09:30 local NY = 15:30 Madrid aprox)
            rth_start_ny = dt_ny.replace(hour=9, minute=30, second=0, microsecond=0)
            # Cierre NY hoy (16:15 local NY = 22:15 Madrid aprox)
            rth_end_ny = dt_ny.replace(hour=16, minute=15, second=0, microsecond=0)
            
            # Inicio Overnight hoy (00:00 local Madrid)
            madrid_tz = pytz.timezone('Europe/Madrid')
            dt_madrid = datetime.fromtimestamp(latest_ts, madrid_tz)
            day_start_madrid = dt_madrid.replace(hour=0, minute=0, second=0, microsecond=0)
            
            min_ts = int(day_start_madrid.timestamp())
            mid_ts = int(rth_start_ny.timestamp())
            max_ts = int(rth_end_ny.timestamp())
            
            logging.info(f"[ZONES] Latest: {dt_madrid} | ON: {day_start_madrid} -> {rth_start_ny} | NY: {rth_start_ny} -> {rth_end_ny}")

            # Filtro Overnight: 00:00 a 15:30 Madrid
            mask_on = (df_all['time'] >= min_ts) & (df_all['time'] < mid_ts)
            on_df = df_all[mask_on].sort_values('time')
            on_candles = on_df.to_dict('records')
            
            # --- RTH (NY): 15:30 a 22:15 Madrid ---
            mask_rth = (df_all['time'] >= mid_ts) & (df_all['time'] <= max_ts)
            rth_df = df_all[mask_rth].sort_values('time')
            rth_candles = rth_df.to_dict('records')

            # Si no hay velas en RTH aún (antes de las 15:30), usamos las últimas disponibles para el cálculo de zonas si es necesario,
            # pero el startTime debe ser el oficial.

            # Calcular Perfil Overnight
            on_vwap_data = []
            on_profile = {"poc": 0, "vah": 0, "val": 0, "histogram": []}
            on_high, on_low = 0, 0
            
            if on_candles:
                on_profile = calculate_volume_profile(on_candles, tick_size, return_histogram=True)
                on_high = max(c.get("high", 0) for c in on_candles)
                on_low = min(c.get("low", float('inf')) for c in on_candles)
                if on_low == float('inf'): on_low = 0
                
                # --- CALCULO VWAP OVERNIGHT (Continúa todo el día) ---
                cum_pv = 0
                cum_vol = 0
                for c in current_day_candles:
                    p = (c.get("high", 0) + c.get("low", 0) + c.get("close", 0)) / 3.0
                    v = c.get("tick_volume", 1)
                    cum_pv += p * v
                    cum_vol += v
                    if cum_vol > 0:
                        on_vwap_data.append({"time": int(c["time"]), "value": round(cum_pv / cum_vol, 2)})
            
            ny_vwap_data = []
            rth_profile = {"poc": 0, "vah": 0, "val": 0, "histogram": []}
            if rth_candles:
                rth_profile = calculate_volume_profile(rth_candles, tick_size, return_histogram=True)
                
                # --- CALCULO VWAP NY (RTH) (Desde 13:30 UTC) ---
                cum_pv = 0
                cum_vol = 0
                for c in rth_candles:
                    p = (c.get("high", 0) + c.get("low", 0) + c.get("close", 0)) / 3.0
                    v = c.get("tick_volume", 1)
                    cum_pv += p * v
                    cum_vol += v
                    if cum_vol > 0:
                        ny_vwap_data.append({"time": int(c["time"]), "value": round(cum_pv / cum_vol, 2)})
            
            logging.info(f"[ZoneCalculator] Candles ON: {len(on_candles)} | RTH: {len(rth_candles)}")
            
    except Exception as e:
        logging.error(f"[ZoneCalculator] Error calculating Sessions: {e}")
        on_profile = {"poc": 0, "vah": 0, "val": 0, "histogram": []}
        rth_profile = {"poc": 0, "vah": 0, "val": 0, "histogram": []}
        on_high, on_low = 0, 0

    # --- Gap RTH ---
    prev_close = prev_day_candles[-1].get("close", 0) if prev_day_candles else 0
    current_open = current_day_candles[0].get("open", 0) if current_day_candles else 0
    gap_size = round(current_open - prev_close, 2)
    gap_direction = "up" if gap_size > 0 else ("down" if gap_size < 0 else "none")
    
    # --- Daily Bias (Módulo 4.1: migración del valor) ---
    # Comparar POC del día anterior con el actual parcial
    current_vp = calculate_volume_profile(current_day_candles, tick_size)
    
    bias_direction = "neutral"
    bias_confidence = 0
    
    if prev_vp["poc"] > 0 and current_vp["poc"] > 0:
        if current_vp["val"] > prev_vp["val"]:
            bias_direction = "bullish"
            # Confianza: cuanto más arriba esté el valor actual respecto al anterior
            diff_ratio = (current_vp["val"] - prev_vp["val"]) / max(1, prev_vp["vah"] - prev_vp["val"])
            bias_confidence = min(100, int(diff_ratio * 100))
        elif current_vp["vah"] < prev_vp["vah"]:
            bias_direction = "bearish"
            diff_ratio = (prev_vp["vah"] - current_vp["vah"]) / max(1, prev_vp["vah"] - prev_vp["val"])
            bias_confidence = min(100, int(diff_ratio * 100))
    
    # --- CVD (Cumulative Volume Delta) ---
    cvd_data = []
    current_cvd = 0
    for c in current_day_candles:
        # Heurística de Delta si no hay datos de ticks detallados: 
        # (Close - Open) / (High - Low) * Volume
        # Para DEMO, VirtualFeed ya genera delta, pero aquí usamos una estimación base
        # o podemos mejorar el modelo de datos.
        body = c.get("close", 0) - c.get("open", 0)
        rng = max(0.25, c.get("high", 0) - c.get("low", 0))
        vol = c.get("tick_volume", 0)
        
        delta = (body / rng) * vol
        current_cvd += delta
        cvd_data.append({"time": int(c.get("time")), "value": round(current_cvd, 2)})

    return {
        "prev_day": {
            "poc": prev_vp["poc"],
            "vah": prev_vp["vah"],
            "val": prev_vp["val"],
            "high": round(prev_high, 2),
            "low": round(prev_low, 2)
        },
        "current_day": {
            "poc": current_vp["poc"],
            "vah": current_vp["vah"],
            "val": current_vp["val"],
            "cvd": cvd_data
        },
        "initial_balance": {
            "high": round(ib_high, 2),
            "low": round(ib_low, 2),
            "start_time": int(ib_candles[0].get("time")) if ib_candles else 0,
            "end_time": int(ib_candles[-1].get("time")) if ib_candles else 0
        },
        "overnight": {
            "high": round(on_high, 2),
            "low": round(on_low, 2),
            "poc": on_profile.get("poc", 0),
            "vah": on_profile.get("vah", 0),
            "val": on_profile.get("val", 0),
            "start_time": min_ts,
            "end_time": mid_ts,
            "histogram": on_profile.get("histogram", []),
            "vwap": on_vwap_data
        },
        "rth": {
            "poc": rth_profile.get("poc", 0),
            "vah": rth_profile.get("vah", 0),
            "val": rth_profile.get("val", 0),
            "start_time": mid_ts,
            "end_time": max_ts,
            "histogram": rth_profile.get("histogram", []),
            "vwap": ny_vwap_data
        },
        "gap": {
            "size": abs(gap_size),
            "direction": gap_direction,
            "prev_close": round(prev_close, 2),
            "current_open": round(current_open, 2)
        },
        "bias": {
            "direction": bias_direction,
            "confidence": bias_confidence
        }
    }

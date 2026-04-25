import asyncio
import json
import sys
import os

# Add parent to path so we can import app modules
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from app.services.rithmic_service import rithmic_service

async def probe():
    print("=" * 60)
    print("PROBE RITHMIC: Campos disponibles en Historical Tick Data")
    print("=" * 60)
    
    connected = await rithmic_service.connect()
    if not connected:
        print("ERROR: No se pudo conectar a Rithmic")
        return
    
    history = rithmic_service._client.plants.get('history')
    if not history:
        print("ERROR: History Plant no disponible")
        return
    
    from datetime import datetime, timedelta
    end = datetime.utcnow()
    start = end - timedelta(minutes=5)
    
    symbol, exchange = rithmic_service.translate_symbol("ES")
    target = await rithmic_service._resolve_rithmic_symbol(symbol, exchange)
    
    print(f"\nSimbolo: {target} @ {exchange}")
    print(f"Ventana: {start} -> {end}")
    
    try:
        ticks = await history.get_historical_tick_data(
            symbol=target, exchange=exchange,
            start_time=start, end_time=end
        )
    except Exception as e:
        print(f"ERROR llamando get_historical_tick_data: {e}")
        return
    
    print(f"\nTotal ticks recibidos: {len(ticks)}")
    
    if not ticks:
        print("WARNING: No se recibieron ticks. Rithmic podria no tener datos para esta ventana.")
        return
    
    # Imprimir TODOS los campos del primer tick
    first = ticks[0]
    print("\n" + "=" * 60)
    print("PRIMER TICK (todos los campos)")
    print("=" * 60)
    print(json.dumps(first, indent=2, default=str))
    
    # Contar campos presentes en todos los ticks
    all_keys = set()
    for t in ticks:
        if isinstance(t, dict):
            all_keys.update(t.keys())
        else:
            # Es un objeto protobuf o similar
            all_keys.update([a for a in dir(t) if not a.startswith('_')])
    
    print("\n" + "=" * 60)
    print("CAMPOS DISPONIBLES (union de todos los ticks)")
    print("=" * 60)
    print(sorted(all_keys))
    
    # Buscar candidatos bid/ask/side
    bid_ask_keys = [k for k in all_keys if any(x in k.lower() for x in ['bid','ask','side','aggr','init','buy','sell'])]
    print("\n" + "=" * 60)
    print("CANDIDATOS BID/ASK/SIDE")
    print("=" * 60)
    if bid_ask_keys:
        for k in bid_ask_keys:
            # Mostrar valor del primer tick para cada campo
            val = first.get(k) if isinstance(first, dict) else getattr(first, k, None)
            print(f"  {k}: {val}")
    else:
        print("  NINGUNO ENCONTRADO")
    
    # Estadisticas de valores para campos numericos relevantes
    numeric_candidates = ['volume', 'bid_volume', 'ask_volume', 'bid_size', 'ask_size', 'last_trade_size']
    print("\n" + "=" * 60)
    print("ESTADISTICAS CAMPOS NUMERICOS (primeros 100 ticks)")
    print("=" * 60)
    for candidate in numeric_candidates:
        if candidate in all_keys:
            vals = []
            for t in ticks[:100]:
                try:
                    v = t.get(candidate) if isinstance(t, dict) else getattr(t, candidate, None)
                    if v is not None:
                        vals.append(float(v))
                except:
                    pass
            if vals:
                print(f"  {candidate}: count={len(vals)}, min={min(vals):.2f}, max={max(vals):.2f}, avg={sum(vals)/len(vals):.2f}")
            else:
                print(f"  {candidate}: presente pero sin valores numericos validos")

if __name__ == "__main__":
    asyncio.run(probe())

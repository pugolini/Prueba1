import React, { useEffect, useRef, useState, useCallback } from 'react';
import { DataIngestor } from '../../engine/footprint/DataIngestor';
import { POCEngine } from '../../engine/footprint/POCEngine';
import { CanvasRenderer } from '../../engine/footprint/CanvasRenderer';
import { FootprintDatabase, StorageManager, CandleData } from '../../engine/footprint/StorageManager';
import { useStore } from '../../store/useStore';
import axios from 'axios';

interface FootprintChartProps {
  symbol: string;
  timeframe?: '1m' | '5m';
}

export const FootprintChart: React.FC<FootprintChartProps> = ({ symbol, timeframe = '1m' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const ingestorRef = useRef<DataIngestor | null>(null);
  const engineRef = useRef<POCEngine | null>(null);
  const rendererRef = useRef<CanvasRenderer | null>(null);
  
  const [isConnected, setIsConnected] = useState(false);
  
  const [zoomX, setZoomX] = useState<number>(1);
  const [offsetY, setOffsetY] = useState<number>(0);
  
  const historyCache = useRef<CandleData[]>([]);

    useEffect(() => {
        if (!canvasRef.current || !containerRef.current) return;
        
        const renderer = new CanvasRenderer(canvasRef.current);
        rendererRef.current = renderer;
        
        const { clientWidth, clientHeight } = containerRef.current;
        renderer.updateDimensions(clientWidth, clientHeight);

        const engine = new POCEngine();
        engineRef.current = engine;
        
        setIsConnected(true); 

        const fetchHistoricalFootprint = async () => {
            try {
                const response = await axios.get(`http://127.0.0.1:8000/api/history-footprint/${symbol}?timeframe=${timeframe}&count=30000`);
                const rawData = response.data;
                
                const newCandles: CandleData[] = Object.entries(rawData).map(([ts, prices]: [string, any]) => {
                    const timestamp = parseInt(ts);
                    const priceMap: Record<number, { bidVol: number; askVol: number; totalVol: number }> = {};
                    let totalVol = 0;
                    let totalDelta = 0;
                    let high = -Infinity;
                    let low = Infinity;
                    let pocPrice = 0;
                    let maxVolAtPrice = -1;

                    const sortedPrices = Object.entries(prices)
                        .map(([p, f]: [string, any]) => ({ price: parseFloat(p), flows: f }))
                        .sort((a, b) => a.price - b.price);

                    if (sortedPrices.length === 0) return null;

                    sortedPrices.forEach(({ price, flows }) => {
                        const bid = flows.bid || 0;
                        const ask = flows.ask || 0;
                        const vol = bid + ask;
                        
                        priceMap[price] = { bidVol: bid, askVol: ask, totalVol: vol };
                        totalVol += vol;
                        totalDelta += (ask - bid);
                        if (price > high) high = price;
                        if (price < low) low = price;
                        
                        if (vol > maxVolAtPrice) {
                            maxVolAtPrice = vol;
                            pocPrice = price;
                        }
                    });

                    return {
                        timestamp,
                        symbol,
                        timeframe,
                        open: sortedPrices[0].price,
                        high,
                        low,
                        close: sortedPrices[sortedPrices.length - 1].price,
                        totalVolume: totalVol,
                        totalDelta,
                        pocPrice,
                        priceMap
                    };
                }).filter(c => c !== null) as CandleData[];

                for (const candle of newCandles) {
                    await StorageManager.putCandle(candle);
                }

                return newCandles;
            } catch (e) {
                console.error("Backfill failed:", e);
                return [];
            }
        };

        const initChart = async () => {
            // 1. Limpiar datos antiguos de forma determinista para evitar saltos
            await StorageManager.clearSymbolData(symbol, timeframe);

            // 2. Cargar historial inicial (Combinando DB + Server)
            await fetchHistoricalFootprint();
            const history = await StorageManager.getHistoricalCandles(symbol, timeframe);
            
            historyCache.current = history;
            renderer.setData(history, null);
        };

        initChart();

    // 2. Suscripción reactiva al Store (Zustand)
    // Escuchamos la vela viva para actualizaciones instantáneas de 60fps
    const unsubscribe = useStore.subscribe(
        state => state.liveFootprintCandle, 
        (liveCandle) => {
            if (!liveCandle || liveCandle.symbol !== symbol) return;
            
            // Actualizamos solo la vela viva sin re-leer toda la DB
            renderer.setData(historyCache.current, liveCandle);
            
            // Si la vela ha cambiado de timestamp, refrescamos el cache brevemente
            if (!historyCache.current.length || historyCache.current[historyCache.current.length - 1].timestamp !== liveCandle.timestamp) {
                StorageManager.getHistoricalCandles(symbol, timeframe).then(history => {
                    historyCache.current = history;
                });
            }
        }
    );

    const resizeObs = new ResizeObserver((entries) => {
      if (entries[0]) {
         const { width, height } = entries[0].contentRect;
         // Handle edge case when element becomes hidden
         if (width > 0 && height > 0) {
             rendererRef.current?.updateDimensions(width, height);
         }
      }
    });
    resizeObs.observe(containerRef.current);

    return () => {
      resizeObs.disconnect();
      unsubscribe();
    };
  }, [symbol, timeframe]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
      if (!rendererRef.current) return;
      e.preventDefault();
      
      if (e.ctrlKey) {
        setZoomX(prev => {
            const nuevo = prev * (e.deltaY > 0 ? 0.9 : 1.1);
            return Math.max(0.1, Math.min(nuevo, 5));
        });
      } else {
        setOffsetY(prev => prev - e.deltaY);
      }
  }, []);

  useEffect(() => {
     if (rendererRef.current) {
         rendererRef.current.setOptions({ zoomX, offsetY });
     }
  }, [zoomX, offsetY]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheelNative = (e: WheelEvent) => {
        if (!rendererRef.current) return;
        e.preventDefault();
        
        if (e.ctrlKey) {
          setZoomX(prev => {
              const nuevo = prev * (e.deltaY > 0 ? 0.9 : 1.1);
              return Math.max(0.1, Math.min(nuevo, 5));
          });
        } else {
          setOffsetY(prev => prev - e.deltaY);
        }
    };

    container.addEventListener('wheel', handleWheelNative, { passive: false });
    return () => container.removeEventListener('wheel', handleWheelNative);
  }, []);

  return (
    <div 
        ref={containerRef} 
        style={{ width: '100%', height: '100%', position: 'relative', overflow: 'hidden' }}
    >
      <div style={{ position: 'absolute', top: 16, left: 16, display: 'flex', gap: 16, zIndex: 10, fontSize: '0.75rem', fontFamily: 'monospace', color: '#CBD5E1' }}>

         <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.8)', padding: '4px 12px', borderRadius: 4, border: '1px solid #334155' }}>
             <span style={{ fontWeight: 'bold', color: '#F1F5F9' }}>{symbol}</span> {timeframe.toUpperCase()}
         </div>
         <div style={{ padding: '4px 12px', borderRadius: 4, display: 'flex', alignItems: 'center', gap: 8, ...isConnected ? { backgroundColor: 'rgba(6, 78, 59, 0.4)', border: '1px solid rgba(16, 185, 129, 0.5)', color: '#34D399' } : { backgroundColor: 'rgba(127, 29, 29, 0.4)', border: '1px solid rgba(239, 68, 68, 0.5)', color: '#F87171' } }}>
             <span style={{ width: 8, height: 8, borderRadius: '50%', backgroundColor: isConnected ? '#10B981' : '#EF4444' }}></span>
             {isConnected ? 'LIVE FEED (RITHMIC)' : 'DISCONNECTED'}
         </div>
      </div>
      <canvas 
          ref={canvasRef} 
          style={{ width: '100%', height: '100%', display: 'block', touchAction: 'none' }}
      />
    </div>
  );
};

import React, { useEffect, useRef } from 'react';
import { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { useStore } from '../../store/useStore';

import { OrderFlowAnalyzer } from '../../engine/orderflow/OrderFlowAnalyzer';

interface OrderFlowStrategiesOverlayProps {
  chart: IChartApi;
  series: ISeriesApi<"Candlestick">;
}

const analyzer = new OrderFlowAnalyzer(0.25); // Instancia persistente

const OrderFlowStrategiesOverlay: React.FC<OrderFlowStrategiesOverlayProps> = ({ chart, series }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const { 
    symbol,
    orderFlowStrategies, 
    theme, 
    isFootprintEnabled 
  } = useStore();

  useEffect(() => {
    if (!canvasRef.current) return;

    // Reset inicial del analizador cuando cambia el símbolo 
    const tick = symbol.includes('ES') || symbol.includes('S&P') ? 0.25 : 0.25;
    analyzer.reset(tick);

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const data = useStore.getState().data;
      const footprintData = useStore.getState().footprintData;

      if (data.length < 2) return;

      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      // Limpiar con coordenadas absolutas de pixel
      ctx.save();
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.restore();

      const timeScale = chart.timeScale();
      const isDark = theme === 'dark';

      // Almacén temporal de señales E1 para detectar E2
      const e1Signals: { time: number, poc: number, type: 'bull' | 'bear' }[] = [];

      // 1-3. Procesamiento de velas
      const visibleRange = chart.timeScale().getVisibleLogicalRange();
      const from = Math.max(1, Math.floor(visibleRange?.from ?? 0));
      const to   = Math.min(data.length, Math.ceil(visibleRange?.to ?? data.length));
      
      for (let i = from; i < to; i++) {
        const bar1 = data[i - 1];
        const bar2 = data[i];
        const f1 = footprintData[bar1.time as any];
        const f2 = footprintData[bar2.time as any];

        if (!f1 || !f2) continue;

        const stats1 = calculateDeltaAndPoc(f1);
        const stats2 = calculateDeltaAndPoc(f2);

        // --- Estrategia ADRIANUS: Trap Detector (Movido a Plugin Nativo V5) ---

        // --- Estrategia 3: Contexto Macro (Puntos Gorda) ---

        // --- Estrategia 1: Diferencial de Delta ---
        if (orderFlowStrategies.deltaDifferential || orderFlowStrategies.doubleDelta) {
            const isV1Bear = bar1.close < bar1.open && stats1.delta < 0;
            const isV2Bull = bar2.close > bar2.open && stats2.delta > 0;
            const ratioOk = Math.abs(stats2.delta) >= Math.abs(stats1.delta) * 1.5;

            if (isV1Bear && isV2Bull && ratioOk) {
                if (orderFlowStrategies.deltaDifferential) {
                    renderSignal(ctx, timeScale, bar1.time as any, bar2.time as any, stats1.poc, stats2.poc, 'bull', 'E1', isDark);
                }
                e1Signals.push({ time: bar2.time as number, poc: stats2.poc, type: 'bull' });
            }

            const isV1Bull = bar1.close > bar1.open && stats1.delta > 0;
            const isV2Bear = bar2.close < bar2.open && stats2.delta < 0;
            if (isV1Bull && isV2Bear && ratioOk) {
                if (orderFlowStrategies.deltaDifferential) {
                    renderSignal(ctx, timeScale, bar1.time as any, bar2.time as any, stats1.poc, stats2.poc, 'bear', 'E1', isDark);
                }
                e1Signals.push({ time: bar2.time as number, poc: stats2.poc, type: 'bear' });
            }
        }
      }

      // --- Estrategia 2: La Doble Delta ---
      if (orderFlowStrategies.doubleDelta) {
          detectDoubleDelta(ctx, timeScale, e1Signals, isDark);
      }

      // --- Estrategia 4: Post-Noticia (Caza Liq) ---
      if (orderFlowStrategies.postNews) {
          detectPostNewsHunt(ctx, timeScale, e1Signals, isDark);
      }

      // --- Estrategia 5: Volume Profile Estructural ---
      // if (orderFlowStrategies.volumeProfile) {
      //   renderStructuralVolumeProfile(ctx, timeScale, isDark);
      // }
    };

    const detectDoubleDelta = (ctx: CanvasRenderingContext2D, timeScale: any, signals: any[], isDark: boolean) => {
        for (let i = 1; i < signals.length; i++) {
            const prev = signals[i-1];
            const curr = signals[i];
            
            const sameType = prev.type === curr.type;
            const nearPrice = Math.abs(prev.poc - curr.poc) < (curr.poc * 0.001);
            const timeDiff = curr.time - prev.time;
            
            if (sameType && nearPrice && timeDiff < 3600 * 5) {
                renderSignal(ctx, timeScale, prev.time, curr.time, prev.poc, curr.poc, curr.type, 'E2', isDark, true);
            }
        }
    };

    const detectPostNewsHunt = (ctx: CanvasRenderingContext2D, timeScale: any, signals: any[], isDark: boolean) => {
        const data = useStore.getState().data;
        for (let i = 1; i < data.length; i++) {
            const bar = data[i];
            const candleSize = bar.high - bar.low;
            const bodySize = Math.abs(bar.close - bar.open);
            if (candleSize > bodySize * 4) {
                const newsExtreme = bar.close > bar.open ? bar.low : bar.high;
                const e2Near = signals.find(s => Math.abs(s.poc - newsExtreme) < (newsExtreme * 0.0005));
                if (e2Near) {
                    renderSignal(ctx, timeScale, bar.time as any, e2Near.time, newsExtreme, e2Near.poc, e2Near.type, 'E4 News', isDark, true);
                }
            }
        }
    };

    const renderStructuralVolumeProfile = (ctx: CanvasRenderingContext2D, timeScale: any, isDark: boolean) => {
        const data = useStore.getState().data;
        const footprintData = useStore.getState().footprintData;
        const bins: Record<string, number> = {};
        data.slice(-300).forEach((bar: any) => {
            const f = footprintData[bar.time as any];
            if (f) {
                Object.entries(f).forEach(([p, v]) => {
                    const price = parseFloat(p);
                    const vol = v.ask + v.bid;
                    const key = price.toFixed(2);
                    bins[key] = (bins[key] || 0) + vol;
                });
            }
        });

        const sortedBins = Object.entries(bins).sort((a,b) => parseFloat(a[0]) - parseFloat(b[0]));
        if (sortedBins.length === 0) return;

        let maxVol = 0;
        let poc = 0;
        sortedBins.forEach(([p, v]) => {
            if (v > maxVol) { maxVol = v; poc = parseFloat(p); }
        });

        const pocY = series.priceToCoordinate(poc);
        if (pocY === null) return;

        ctx.save();
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = '#ff9800';
        ctx.beginPath();
        ctx.moveTo(0, pocY);
        ctx.lineTo(canvas.width, pocY);
        ctx.stroke();
        ctx.fillStyle = '#ff9800';
        ctx.font = 'bold 10px Inter';
        ctx.fillText('STRUCTURAL POC', 10, pocY - 5);
        ctx.restore();
    };

    const renderSignal = (ctx: CanvasRenderingContext2D, timeScale: any, t1: number, t2: number, poc1: number, poc2: number, type: 'bull' | 'bear', label: string, isDark: boolean, isDouble = false) => {
        const x1 = timeScale.timeToCoordinate(t1 as Time);
        const x2 = timeScale.timeToCoordinate(t2 as Time);
        
        if (x1 === null || x2 === null) return;
        // Viewport Culling para rectángulos
        if ((x1 < -500 && x2 < -500) || (x1 > canvas.width + 500 && x2 > canvas.width + 500)) return;

        const y1 = series.priceToCoordinate(poc1);
        const y2 = series.priceToCoordinate(poc2);
        if (y1 === null || y2 === null) return;

        const barWidth = timeScale.options().barSpacing;
        ctx.save();
        const mainColor = type === 'bull' ? '#089981' : '#f23645';
        ctx.fillStyle = isDouble ? (type === 'bull' ? 'rgba(0, 255, 127, 0.3)' : 'rgba(255, 69, 0, 0.3)') : (type === 'bull' ? 'rgba(8, 153, 129, 0.15)' : 'rgba(242, 54, 69, 0.15)');
        ctx.strokeStyle = mainColor;
        ctx.lineWidth = isDouble ? 2 : 1;
        const rectX = x1 - barWidth / 2;
        const rectW = (x2 - x1) + barWidth;
        const rectY = Math.min(y1, y2) - 2;
        const rectH = Math.abs(y1 - y2) + 4;
        ctx.fillRect(rectX, rectY, rectW, rectH);
        ctx.strokeRect(rectX, rectY, rectW, rectH);
        ctx.fillStyle = isDouble ? (isDark ? '#fff' : '#000') : (isDark ? '#d1d4dc' : '#434651');
        ctx.font = `bold ${isDouble ? 11 : 9}px Inter`;
        ctx.textAlign = 'center';
        ctx.fillText(label, x2, type === 'bull' ? y2 + 15 : y2 - 8);
        ctx.restore();
    };

    const renderTrapDiamond = (ctx: CanvasRenderingContext2D, timeScale: any, time: number, price: number, type: 'bull' | 'bear', isDark: boolean, isStacked: boolean = false) => {
        // ELIMINADO: Movido a DiamondPrimitive.ts para máxima fluidez
    };

    const renderContextZone = (ctx: CanvasRenderingContext2D, timeScale: any, time: number, poc: number, type: 'bull' | 'bear', isDark: boolean) => {
        const x = timeScale.timeToCoordinate(time as Time);
        
        if (x === null) return;
        // Viewport Culling para círculos
        if (x < -100 || x > canvas.width + 100) return;

        const y = series.priceToCoordinate(poc);
        if (y === null) return;
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, isFootprintEnabled ? 4 : 3, 0, Math.PI * 2);
        ctx.fillStyle = type === 'bull' ? '#00bcd4' : '#ff5722';
        ctx.shadowBlur = 10;
        ctx.shadowColor = ctx.fillStyle as string;
        ctx.fill();
        ctx.font = '8px Inter';
        ctx.fillStyle = isDark ? '#fff' : '#000';
        ctx.textAlign = 'center';
        ctx.fillText('CTX', x, y - 10);
        ctx.restore();
    };

    const calculateDeltaAndPoc = (fData: Record<number, { bid: number, ask: number }>) => {
        let delta = 0;
        let maxVol = 0;
        let poc = 0;
        Object.entries(fData).forEach(([p, v]) => {
            delta += (v.ask - v.bid);
            const vol = v.ask + v.bid;
            if (vol > maxVol) { maxVol = vol; poc = parseFloat(p); }
        });
        return { delta, poc };
    };

    const timeScale = chart.timeScale();
    const handleRangeChange = () => {
        requestAnimationFrame(render);
    };

    chart.subscribeClick(handleRangeChange);
    timeScale.subscribeVisibleTimeRangeChange(handleRangeChange);
    timeScale.subscribeVisibleLogicalRangeChange(handleRangeChange);
    
    // Suscripción de alto rendimiento a ticks (bypasseando re-renders de React)
    const unsubscribeStore = useStore.subscribe(
        (state: any) => state.lastTickTime,
        () => { requestAnimationFrame(render); }
    );

    const resizeCanvas = () => {
        if (canvas.parentElement) {
            const dpr = window.devicePixelRatio || 1;
            canvas.width = canvas.parentElement.clientWidth * dpr;
            canvas.height = canvas.parentElement.clientHeight * dpr;
            const ctx = canvas.getContext('2d');
            if (ctx) {
                ctx.setTransform(1, 0, 0, 1, 0, 0);
                ctx.scale(dpr, dpr);
            }
            render();
        }
    };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas(); // Render inicial

    return () => {
        window.removeEventListener('resize', resizeCanvas);
        chart.unsubscribeClick(handleRangeChange);
        timeScale.unsubscribeVisibleTimeRangeChange(handleRangeChange);
        timeScale.unsubscribeVisibleLogicalRangeChange(handleRangeChange);
        unsubscribeStore();
    };
  }, [orderFlowStrategies, theme, chart, series, isFootprintEnabled]);

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 11 }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default OrderFlowStrategiesOverlay;

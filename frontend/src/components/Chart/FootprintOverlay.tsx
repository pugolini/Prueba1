import React, { useEffect, useRef } from 'react';
import { IChartApi, ISeriesApi } from 'lightweight-charts';
import { useStore } from '../../store/useStore';

interface FootprintOverlayProps {
  chart: IChartApi;
  series: ISeriesApi<"Candlestick">;
}

const FootprintOverlay: React.FC<FootprintOverlayProps> = ({ chart, series }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const { isFootprintEnabled, theme, timeframe, footprintData, lastTickTime } = useStore();

  useEffect(() => {
    if (!isFootprintEnabled || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      // FIX #5: DPR para nitidez en HiDPI
      const dpr = window.devicePixelRatio || 1;
      const width = canvas.width / dpr;
      const height = canvas.height / dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, width, height);

      const timeScale = chart.timeScale();
      const visibleRange = timeScale.getVisibleRange();
      if (!visibleRange) return;

      const { footprintData } = useStore.getState();
      const entries = Object.entries(footprintData);
      
      // Feedback si no hay datos
      if (entries.length === 0) {
        ctx.fillStyle = 'rgba(173, 181, 189, 0.5)';
        ctx.font = '12px Inter, sans-serif';
        ctx.fillText('FOOTPRINT ACTIVE - WAITING FOR TICKS...', width / 2, 40);
        return;
      }

      const isDark = theme === 'dark';
      ctx.font = 'bold 9px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';

      // Iterar sobre las velas con datos (Renderizado Individual Puro)
      entries.forEach(([timeStr, priceMap]) => {
        const time = parseInt(timeStr);

        let x = timeScale.timeToCoordinate(time as any);
        
        // --- PROYECCIÓN Y TOLERANCIA HISTÓRICA (v11.2) ---
        if (x === null) {
            const data = useStore.getState().data;
            
            // 1. Fallback Histórico: Buscar vela más cercana (tolerancia de 2h/7200s por offsets MT5/Rithmic)
            if (data.length > 0) {
                let bestMatch = data[0];
                let minDiff = Math.abs((bestMatch.time as number) - time);
                
                for (let i = 1; i < data.length; i++) {
                    const diff = Math.abs((data[i].time as number) - time);
                    if (diff < minDiff) {
                        minDiff = diff;
                        bestMatch = data[i];
                    }
                }
                
                // Si la vela más cercana está a menos de 2 horas (offset de broker típico), la usamos
                if (minDiff <= 7200) {
                    x = timeScale.timeToCoordinate(bestMatch.time as any);
                }
            }

            // 2. Fallback Futuro: Proyección para mercado en vivo que excede el gráfico MT5
            if (x === null) {
                const lastBarTime = data.length > 0 ? (data[data.length - 1].time as number) : 0;
                if (lastBarTime > 0 && time > lastBarTime) {
                    const lastX = timeScale.timeToCoordinate(lastBarTime as any);
                    if (lastX !== null) {
                        const barWidth = timeScale.options().barSpacing;
                        let tfSec = 60;
                        const tfStr = (useStore.getState().timeframe || '1m').toLowerCase();
                        if (tfStr.includes('m')) tfSec = parseInt(tfStr) * 60;
                        else if (tfStr.includes('h')) tfSec = parseInt(tfStr) * 3600;
                        else if (tfStr.includes('d')) tfSec = 24 * 3600;
                        else {
                            const num = parseInt(tfStr);
                            tfSec = num < 60 ? num * 60 : num;
                        }

                        const barsDiff = (time - lastBarTime) / tfSec;
                        x = lastX + (barWidth * barsDiff);
                    }
                }
            }
        }

        if (x === null || x < -300 || x > width + 500) return;
        const finalX = x;

        const barWidth = timeScale.options().barSpacing;
        // El heatmap de celdas solo se dibuja con zoom suficiente
        const showHeatmapCells = barWidth >= 12;

        let maxVol = 0;
        let pocPrice = 0;
        let totalCandleVol = 0;
        let totalCandleDelta = 0;
        let maxSingleVol = 0;

        let minPrice = Infinity;
        let maxPrice = -Infinity;

        // FIX #2.1: Acumular totales de TODO (incluido inyecciones como "poc") antes de filtrar precio
        Object.entries(priceMap).forEach(([p, vol]: [string, any]) => {
          if (!vol || typeof vol.bid !== 'number' || typeof vol.ask !== 'number') return;

          const total = vol.bid + vol.ask;
          totalCandleVol += total;
          totalCandleDelta += (vol.ask - vol.bid);

          const currentPrice = parseFloat(p);
          if (isNaN(currentPrice)) return; // Ignorar en maxPrice/minPrice pero conservar Delta arriba

          if (total > maxVol) { maxVol = total; pocPrice = currentPrice; }
          if (vol.bid > maxSingleVol) maxSingleVol = vol.bid;
          if (vol.ask > maxSingleVol) maxSingleVol = vol.ask;
          if (currentPrice < minPrice) minPrice = currentPrice;
          if (currentPrice > maxPrice) maxPrice = currentPrice;
        });

        // --- OPTIMIZACIÓN TURBO (v7.5): Clipping y Acceso Directo O(1) ---
        const state = useStore.getState();
        const tickSizeRaw = state.symbolInfo?.tickSize || 0.25;
        
        // Viewport Clipping: Solo procesar lo que se ve en pantalla
        const priceAtTop = series.coordinateToPrice(0) || 0;
        const priceAtBottom = series.coordinateToPrice(height) || 0;
        const visibleMaxP = Math.max(priceAtTop, priceAtBottom) + tickSizeRaw;
        const visibleMinP = Math.min(priceAtTop, priceAtBottom) - tickSizeRaw;

        // Limitar el rango de dibujo al área visible real
        const renderMinP = Math.max(minPrice, visibleMinP);
        const renderMaxP = Math.min(maxPrice, visibleMaxP);

        const m = Math.pow(10, 5); // Multiplicador de precisión
        const stepStr = Math.round(tickSizeRaw * m);
        const startP = Math.round(renderMinP * m);
        const endP = Math.round(renderMaxP * m);

        let lowestY = 0;
        const candleGap = barWidth * 0.41; 
        const maxBoxWidth = barWidth * 0.08; 

        // Solo renderizar celdas del heatmap si hay zoom suficiente (barWidth >= 12)
        if (showHeatmapCells && renderMinP <= renderMaxP) {
            const IMBALANCE_RATIO = 3.0;
            const STACKED_MIN_LEVELS = 3;

            // Pre-cálculo de claves para acceso O(1)
            const getVols = (p: number) => {
                const key = (Math.round(p * m) / m).toString();
                return (priceMap as any)[key] || (priceMap as any)[p.toFixed(2)] || { bid: 0, ask: 0 };
            };

            const askImbalances: Set<number> = new Set();
            const bidImbalances: Set<number> = new Set();

            // Detección de Imbalances solo en el rango visible
            for (let pInt = endP; pInt >= startP; pInt -= stepStr) {
                const price = pInt / m;
                const vols = getVols(price);
                const nextVols = getVols(price + tickSizeRaw);
                const prevVols = getVols(price - tickSizeRaw);

                if (vols.ask >= nextVols.bid * IMBALANCE_RATIO && vols.ask > 0) askImbalances.add(price);
                if (vols.bid >= prevVols.ask * IMBALANCE_RATIO && vols.bid > 0) bidImbalances.add(price);
            }

            // Renderizado de Celdas
            for (let pInt = endP; pInt >= startP; pInt -= stepStr) {
                const price = pInt / m;
                const vols = getVols(price);

                const yTop = series.priceToCoordinate(price + tickSizeRaw);
                const yBottom = series.priceToCoordinate(price);
                if (yBottom === null || yTop === null) continue;

                if (yBottom > lowestY) lowestY = yBottom;
                const cellHeight = Math.max(1.5, Math.abs(yBottom - yTop));
                const cellY = Math.min(yBottom, yTop);
                
                const isPoc = Math.abs(price - pocPrice) < tickSizeRaw * 0.1;
                const bidX = (finalX - candleGap) - maxBoxWidth;
                const askX = finalX + candleGap;
                const emptyBg = isDark ? 'rgba(120, 123, 134, 0.06)' : 'rgba(120, 123, 134, 0.04)';
                
                // Color y Dibujo Bid/Ask
                const isBidImbalance = bidImbalances.has(price);
                const isAskImbalance = askImbalances.has(price);

                ctx.fillStyle = isPoc ? (isDark ? '#e2e8f0' : '#1e293b') : 
                                (vols.bid > 0 ? `rgba(242, 54, 69, ${Math.min((vols.bid / (maxSingleVol || 1)) + 0.15, 0.85)})` : emptyBg);
                ctx.fillRect(bidX, cellY, maxBoxWidth, cellHeight);

                ctx.fillStyle = isPoc ? (isDark ? '#e2e8f0' : '#1e293b') : 
                                (vols.ask > 0 ? `rgba(8, 153, 129, ${Math.min((vols.ask / (maxSingleVol || 1)) + 0.15, 0.85)})` : emptyBg);
                ctx.fillRect(askX, cellY, maxBoxWidth, cellHeight);

                // Bordes de imbalance
                if (isBidImbalance || isAskImbalance) {
                    ctx.lineWidth = 1;
                    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)';
                    ctx.strokeRect(isBidImbalance ? bidX : askX, cellY, maxBoxWidth, cellHeight);
                }

                if (barWidth > 70 && cellHeight > 8) {
                    ctx.font = `bold ${Math.min(10, cellHeight - 2)}px Inter, sans-serif`;
                    ctx.fillStyle = isPoc ? (isDark ? '#000' : '#fff') : (isDark ? '#fff' : '#000');
                    ctx.textAlign = 'right';
                    ctx.fillText(Math.round(vols.bid).toString(), finalX - candleGap - 3, cellY + cellHeight / 2);
                    ctx.textAlign = 'left';
                    ctx.fillText(Math.round(vols.ask).toString(), finalX + candleGap + 3, cellY + cellHeight / 2);
                }
            }
        }

        // --- SUMARIO DELTA (v11 robusto) ---
        ctx.save();
        
        const isPositive = totalCandleDelta >= 0;
        const absDelta = Math.abs(Math.round(totalCandleDelta));
        
        ctx.font = 'bold 11px Inter, sans-serif';
        const textWidth = ctx.measureText(absDelta.toString()).width;
        let boxWidth = Math.max(textWidth + 12, 34); // mínimo 34px de ancho para legibilidad
        // Restricción visual si hay muchas velas (zoom out)
        if (barWidth < 20) boxWidth = Math.max(textWidth + 4, barWidth * 1.5);
        
        const boxHeight = 16;
        const boxX = finalX - boxWidth / 2;
        
        // Clamping estricto para asegurar visibilidad en pantalla
        const boxY = Math.min(lowestY > 0 ? lowestY + 8 : height - 30, height - boxHeight - 4);

        if (boxY > 0 && totalCandleVol > 0) {
            ctx.beginPath();
            ctx.fillStyle = isPositive ? 'rgba(8, 153, 129, 0.85)' : 'rgba(242, 54, 69, 0.85)';
            ctx.roundRect ? ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 4) : ctx.fillRect(boxX, boxY, boxWidth, boxHeight);
            ctx.fill();

            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(absDelta.toString(), finalX, boxY + boxHeight / 2);
        }
        
        ctx.restore();
      });
      console.log('[FP-RENDER]', new Date().toISOString(), 'entries:', entries.length);
    };

    // Sincronizar con cambios en el gráfico
    const timeScale = chart.timeScale();
    
    const handleRangeChange = () => {
        requestAnimationFrame(render);
    };

    chart.subscribeClick(handleRangeChange);
    timeScale.subscribeVisibleTimeRangeChange(handleRangeChange);
    timeScale.subscribeVisibleLogicalRangeChange(handleRangeChange);
    
    // Fix inmediato: usar la firma simple para reaccionar verdaderamente a los triggers
    let lastSeenTick = 0;
    const unsubscribeStore = useStore.subscribe((state) => {
      if (state.lastTickTime !== lastSeenTick) {
        lastSeenTick = state.lastTickTime;
        requestAnimationFrame(render);
      }
    });

    // FIX #5: resize con devicePixelRatio
    const resizeCanvas = () => {
      if (canvas.parentElement) {
        const dpr = window.devicePixelRatio || 1;
        const cssW = canvas.parentElement.clientWidth;
        const cssH = canvas.parentElement.clientHeight;
        canvas.width = cssW * dpr;
        canvas.height = cssH * dpr;
        canvas.style.width = cssW + 'px';
        canvas.style.height = cssH + 'px';
        render();
      }
    };
    window.addEventListener('resize', resizeCanvas);
    resizeCanvas(); // Render inicial automático

    return () => {
      window.removeEventListener('resize', resizeCanvas);
      chart.unsubscribeClick(handleRangeChange);
      timeScale.unsubscribeVisibleTimeRangeChange(handleRangeChange);
      timeScale.unsubscribeVisibleLogicalRangeChange(handleRangeChange);
      unsubscribeStore();
    };
  }, [isFootprintEnabled, theme, timeframe, chart, series]);

  if (!isFootprintEnabled) return null;

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default FootprintOverlay;

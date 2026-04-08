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
  const { isFootprintEnabled, theme } = useStore();

  useEffect(() => {
    if (!isFootprintEnabled || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const render = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      const timeScale = chart.timeScale();
      const visibleRange = timeScale.getVisibleRange();
      if (!visibleRange) return;

      const currentFootprintData = useStore.getState().footprintData;
      const entries = Object.entries(currentFootprintData);
      
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

      // Iterar sobre las velas con datos (Renderizado Individual Puro)
      entries.forEach(([timeStr, priceMap]) => {
        const time = parseInt(timeStr);

        const x = timeScale.timeToCoordinate(time as any);
        if (x === null) {
            const xAlt = timeScale.timeToCoordinate((time + 1) as any) || timeScale.timeToCoordinate((time - 1) as any);
            if (!xAlt) return;
        }
        
        const finalX = x !== null ? x : (timeScale.timeToCoordinate((time + 1) as any) as number);
        if (finalX < -300 || finalX > width + 300) return;

        const barWidth = timeScale.options().barSpacing;
        if (barWidth < 25) return;

        let maxVol = 0;
        let pocPrice = 0;
        let totalCandleVol = 0;
        let totalCandleDelta = 0;
        let maxSingleVol = 0;

        let minPrice = Infinity;
        let maxPrice = -Infinity;

        Object.entries(priceMap).forEach(([p, vol]) => {
          const total = vol.bid + vol.ask;
          totalCandleVol += total;
          totalCandleDelta += (vol.ask - vol.bid);
          const currentPrice = parseFloat(p);
          if (total > maxVol) { maxVol = total; pocPrice = currentPrice; }
          if (vol.bid > maxSingleVol) maxSingleVol = vol.bid;
          if (vol.ask > maxSingleVol) maxSingleVol = vol.ask;
          
          if (currentPrice < minPrice) minPrice = currentPrice;
          if (currentPrice > maxPrice) maxPrice = currentPrice;
        });

        const getTickSize = (p: number) => {
          if (p >= 10000) return 5;
          if (p >= 1000) return 1;
          if (p >= 100) return 0.05;
          if (p >= 5) return 0.01;
          return 0.0001;
        };

        let lowestY = 0; // Guardamos el punto más profundo de ESTA vela en específico

        const candleGap = barWidth * 0.41; 
        const maxBoxWidth = barWidth * 0.08; 

        if (minPrice !== Infinity && maxPrice !== -Infinity) {
            const tickSizeRaw = getTickSize(minPrice);
            // Multiplicador agresivo para evitar pérdida de precisión flotante en el bucle
            const m = Math.pow(10, 5); 
            const startStr = Math.round(minPrice * m);
            const endStr = Math.round(maxPrice * m);
            const stepStr = Math.round(tickSizeRaw * m);

            const IMBALANCE_RATIO = 3.0;
            const STACKED_MIN_LEVELS = 3;

            // Arrays para almacenar imbalances de la vela actual
            const askImbalances: number[] = [];
            const bidImbalances: number[] = [];

            // Primer paso: Detectar Imbalances (Diagonal comparison)
            for (let pInt = endStr; pInt >= startStr; pInt -= stepStr) {
                const price = pInt / m;
                const nextPrice = (pInt + stepStr) / m;
                const prevPrice = (pInt - stepStr) / m;

                const priceKey = Object.keys(priceMap).find(k => Math.abs(parseFloat(k) - price) < tickSizeRaw * 0.1);
                const nextKey = Object.keys(priceMap).find(k => Math.abs(parseFloat(k) - nextPrice) < tickSizeRaw * 0.1);
                const prevKey = Object.keys(priceMap).find(k => Math.abs(parseFloat(k) - prevPrice) < tickSizeRaw * 0.1);

                const vols = priceKey ? (priceMap as any)[priceKey] : { bid: 0, ask: 0 };
                const nextVols = nextKey ? (priceMap as any)[nextKey] : { bid: 0, ask: 0 };
                const prevVols = prevKey ? (priceMap as any)[prevKey] : { bid: 0, ask: 0 };

                // Ask Imbalance: Ask de este precio vs Bid del precio superior
                if (vols.ask >= nextVols.bid * IMBALANCE_RATIO && vols.ask > 0) {
                    askImbalances.push(price);
                }
                // Bid Imbalance: Bid de este precio vs Ask del precio inferior
                if (vols.bid >= prevVols.ask * IMBALANCE_RATIO && vols.bid > 0) {
                    bidImbalances.push(price);
                }
            }

            // Segundo paso: Detectar Stacked Imbalances (Consecutivos)
            const stackedAskPrices: Set<number> = new Set();
            const stackedBidPrices: Set<number> = new Set();

            let currentAskSeries: number[] = [];
            for (let i = 0; i <= (endStr - startStr) / stepStr; i++) {
                const p = (endStr - (i * stepStr)) / m;
                if (askImbalances.includes(p)) {
                    currentAskSeries.push(p);
                } else {
                    if (currentAskSeries.length >= STACKED_MIN_LEVELS) {
                        currentAskSeries.forEach(price => stackedAskPrices.add(price));
                    }
                    currentAskSeries = [];
                }
            }
            if (currentAskSeries.length >= STACKED_MIN_LEVELS) {
                currentAskSeries.forEach(price => stackedAskPrices.add(price));
            }

            let currentBidSeries: number[] = [];
            for (let i = 0; i <= (endStr - startStr) / stepStr; i++) {
                const p = (endStr - (i * stepStr)) / m;
                if (bidImbalances.includes(p)) {
                    currentBidSeries.push(p);
                } else {
                    if (currentBidSeries.length >= STACKED_MIN_LEVELS) {
                        currentBidSeries.forEach(price => stackedBidPrices.add(price));
                    }
                    currentBidSeries = [];
                }
            }
            if (currentBidSeries.length >= STACKED_MIN_LEVELS) {
                currentBidSeries.forEach(price => stackedBidPrices.add(price));
            }

            // Tercer paso: Renderizado
            for (let pInt = endStr; pInt >= startStr; pInt -= stepStr) {
                const price = pInt / m;
                const priceKey = Object.keys(priceMap).find(k => Math.abs(parseFloat(k) - price) < tickSizeRaw * 0.1);
                const vols = priceKey ? (priceMap as any)[priceKey] : { bid: 0, ask: 0 };

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
                
                // Color Bid
                const isStackedBid = stackedBidPrices.has(price);
                const isBidImbalance = bidImbalances.includes(price);
                if (isPoc) {
                    ctx.fillStyle = isDark ? '#e2e8f0' : '#1e293b';
                } else if (isStackedBid) {
                    ctx.fillStyle = '#f23645'; // Rojo sólido para Stacked
                } else if (vols.bid > 0) {
                    const alpha = Math.min((vols.bid / (maxSingleVol || 1)) + 0.15, 0.85);
                    ctx.fillStyle = isBidImbalance ? `rgba(255, 100, 100, ${alpha})` : `rgba(242, 54, 69, ${alpha})`;
                } else {
                    ctx.fillStyle = emptyBg;
                }
                ctx.fillRect(bidX, cellY, maxBoxWidth, cellHeight);

                // Color Ask
                const isStackedAsk = stackedAskPrices.has(price);
                const isAskImbalance = askImbalances.includes(price);
                if (isPoc) {
                    ctx.fillStyle = isDark ? '#e2e8f0' : '#1e293b';
                } else if (isStackedAsk) {
                    ctx.fillStyle = '#089981'; // Verde sólido para Stacked
                } else if (vols.ask > 0) {
                    const alpha = Math.min((vols.ask / (maxSingleVol || 1)) + 0.15, 0.85);
                    ctx.fillStyle = isAskImbalance ? `rgba(100, 255, 150, ${alpha})` : `rgba(8, 153, 129, ${alpha})`;
                } else {
                    ctx.fillStyle = emptyBg;
                }
                ctx.fillRect(askX, cellY, maxBoxWidth, cellHeight);

                // Bordes para Imbalances individuales y Glow para Stacked
                if (isStackedBid || isStackedAsk) {
                    ctx.lineWidth = 2;
                    ctx.strokeStyle = isStackedBid ? '#ff0000' : '#00ff00';
                    ctx.strokeRect(isStackedBid ? bidX : askX, cellY, maxBoxWidth, cellHeight);
                } else if (isBidImbalance || isAskImbalance) {
                    ctx.lineWidth = 1;
                    ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.3)';
                    ctx.strokeRect(isBidImbalance ? bidX : askX, cellY, maxBoxWidth, cellHeight);
                }

                if (isPoc && barWidth > 30) {
                    ctx.setLineDash([2, 4]);
                    ctx.strokeStyle = isDark ? 'rgba(255, 255, 255, 0.5)' : 'rgba(0,0,0,0.5)';
                    ctx.beginPath();
                    ctx.moveTo(bidX - 10, cellY + cellHeight / 2);
                    ctx.lineTo(askX + maxBoxWidth + 10, cellY + cellHeight / 2);
                    ctx.stroke();
                    ctx.setLineDash([]);
                }

                if (barWidth > 70 && cellHeight > 8) {
                    const isMuted = vols.bid === 0 && vols.ask === 0;
                    ctx.font = `bold ${Math.min(10, cellHeight - 2)}px Inter, sans-serif`;
                    const textY = yBottom - (cellHeight / 2) + 3;
                    
                    if (isPoc) {
                       ctx.fillStyle = isDark ? '#000000' : '#ffffff';
                    } else if (isStackedBid || isStackedAsk) {
                       ctx.fillStyle = '#ffffff'; // Blanco sobre color sólido
                    } else if (isMuted) {
                       ctx.fillStyle = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)';
                    } else {
                       ctx.fillStyle = isDark ? '#ffffff' : '#000000';
                    }
                    
                    const formatVol = (v: number) => {
                        if (v === 0) return '0';
                        if (v >= 1000000) return (v/1000000).toFixed(2) + 'M';
                        if (v >= 1000) return (v/1000).toFixed(1) + 'K';
                        return Math.round(v).toString();
                    };

                    ctx.textAlign = 'right';
                    ctx.fillText(formatVol(vols.bid), finalX - candleGap - 3, textY);
                    
                    ctx.textAlign = 'left';
                    ctx.fillText(formatVol(vols.ask), finalX + candleGap + 3, textY);
                }
            }
        }

        // Caja de Resumen Individual adherida inmediatamente bajo el Footprint aislado
        if (barWidth > 30 && lowestY > 0) {
            const isWide = barWidth > 80; 
            const boxWidth = isWide ? Math.min(85, barWidth * 0.95) : barWidth * 0.92;
            const boxHeight = isWide ? 28 : 22; 
            const boxX = finalX - boxWidth / 2;
            // FIJACIÓN FLOTANTE INDIVIDUAL DEBAJO DE LA ÚLTIMA CELDA DE ESTA VELA EXCLUSIVAMENTE
            const boxY = lowestY + 12;

            ctx.save();
            ctx.shadowColor = 'rgba(0, 0, 0, 0.15)';
            ctx.shadowBlur = isWide ? 6 : 2;
            ctx.shadowOffsetY = isWide ? 3 : 1;
            ctx.fillStyle = isDark ? '#1e222d' : '#ffffff';
            
            ctx.beginPath();
            ctx.roundRect(boxX, boxY, boxWidth, boxHeight, 4);
            ctx.fill();
            ctx.restore();

            ctx.strokeStyle = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)';
            ctx.lineWidth = 1;
            ctx.stroke();

            const formatVol = (v: number) => {
               if (Math.abs(v) >= 1000000) return (Math.abs(v)/1000000).toFixed(2) + 'M';
               if (Math.abs(v) >= 10000) return (Math.abs(v)/1000).toFixed(0) + 'K';
               if (Math.abs(v) >= 1000) return (Math.abs(v)/1000).toFixed(1) + 'K';
               return Math.round(Math.abs(v)).toString();
            };

            const deltaColor = totalCandleDelta > 0 ? '#089981' : (totalCandleDelta < 0 ? '#f23645' : (isDark ? '#fff' : '#000'));
            const deltaStr = totalCandleDelta > 0 ? `+${formatVol(totalCandleDelta)}` : (totalCandleDelta < 0 ? `-${formatVol(Math.abs(totalCandleDelta))}` : formatVol(totalCandleDelta));
            const totalStr = formatVol(totalCandleVol);

            ctx.font = isWide ? 'bold 9px Inter, sans-serif' : 'bold 8px Inter, sans-serif';
            
            if (isWide) {
                ctx.textAlign = 'right';
                ctx.fillStyle = isDark ? '#b2b5be' : '#787b86';
                ctx.fillText('Delta', boxX + boxWidth / 2 - 4, boxY + 11);
                
                ctx.textAlign = 'left';
                ctx.fillStyle = deltaColor;
                ctx.fillText(deltaStr, boxX + boxWidth / 2 + 4, boxY + 11);

                ctx.textAlign = 'right';
                ctx.fillStyle = isDark ? '#b2b5be' : '#787b86';
                ctx.fillText('Total', boxX + boxWidth / 2 - 4, boxY + 22);
                 
                ctx.textAlign = 'left';
                ctx.fillStyle = isDark ? '#ffffff' : '#131722';
                ctx.fillText(totalStr, boxX + boxWidth / 2 + 4, boxY + 22);
            } else {
                ctx.textAlign = 'center';
                ctx.fillStyle = deltaColor;
                ctx.fillText(deltaStr, finalX, boxY + 9);
                ctx.fillStyle = isDark ? '#8a8d95' : '#787b86';
                ctx.fillText(totalStr, finalX, boxY + 18);
            }
        }
      });
    };

    // Sincronizar con cambios en el gráfico
    const timeScale = chart.timeScale();
    
    const handleRangeChange = () => {
        requestAnimationFrame(render);
    };

    chart.subscribeClick(handleRangeChange);
    timeScale.subscribeVisibleTimeRangeChange(handleRangeChange);
    timeScale.subscribeVisibleLogicalRangeChange(handleRangeChange);
    
    // Suscripción de alto rendimiento a ticks (bypasseando re-renders de React)
    let lastFootprintData = useStore.getState().footprintData;
    const unsubscribeStore = useStore.subscribe((state: any) => {
        if (state.footprintData !== lastFootprintData) {
            lastFootprintData = state.footprintData;
            requestAnimationFrame(render);
        }
    });

    const resizeCanvas = () => {
        if (canvas.parentElement) {
            canvas.width = canvas.parentElement.clientWidth;
            canvas.height = canvas.parentElement.clientHeight;
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
  }, [isFootprintEnabled, theme, chart, series]);

  if (!isFootprintEnabled) return null;

  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 10 }}>
      <canvas ref={canvasRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default FootprintOverlay;

import React, { useEffect, useRef } from 'react';
import { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { useStore } from '../../store/useStore';

interface BigTradesProps {
    chart: IChartApi;
    series: ISeriesApi<"Candlestick">;
}

export const BigTradesOverlay: React.FC<BigTradesProps> = ({ chart, series }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const enabled = useStore(s => s.orderFlowStrategies.bigTrades);
    const trades = useStore(s => s.bigTradesData);
    const minSize = useStore(s => s.minTradeSize);
    const theme = useStore(s => s.theme);
    const timeframe = useStore(s => s.timeframe);
    const currentSymbol = useStore(s => s.symbol);
    
    const serverOffset = useStore(s => s.serverOffset);
    
    const render = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Solo renderizar si la estrategia está activa
        if (!enabled || trades.length === 0) return;

        // 1. Obtener datos de la serie para sincronización temporal
        const seriesData = series.data();
        if (seriesData.length === 0) return;
        
        const timeScale = chart.timeScale();
        const timeOffset = serverOffset || 0;
        
        let tfSeconds = 60;
        if (timeframe.includes('m')) tfSeconds = parseInt(timeframe) * 60;
        else if (timeframe.includes('h')) tfSeconds = parseInt(timeframe) * 3600;
        else if (timeframe.includes('d')) tfSeconds = 86400;

        // Filtrar y dibujar trades reales
        trades.forEach((trade) => {
            const tradeSym = trade.symbol?.toUpperCase() || "";
            const activeSym = currentSymbol?.toUpperCase() || "";
            const isMatch = tradeSym.includes(activeSym) || activeSym.includes(tradeSym) || tradeSym === "";
            
            if (!isMatch) return;

            const numericMinSize = Number(minSize) || 1;
            if (trade.size < numericMinSize) return;
            
            // 🕒 SINCRONIZACIÓN MAESTRA PUGOBOT
            let tSec = trade.time > 2000000000 ? Math.floor(trade.time / 1000) : trade.time;
            
            // Aplicar offset detectado para que la burbuja "salte" a la hora del gráfico
            const adjustedTime = tSec + timeOffset;
            
            let x = timeScale.timeToCoordinate(adjustedTime as Time);
            if (x === null) {
                const snappedTime = Math.floor(adjustedTime / tfSeconds) * tfSeconds;
                x = timeScale.timeToCoordinate(snappedTime as Time);
            }
            
            const y = series.priceToCoordinate(trade.price);
            
            if (x === null || y === null) return;
            
            if (x < -100 || x > canvas.width + 100 || y < -100 || y > canvas.height + 100) return;

            const radius = Math.max(7, Math.sqrt(trade.size) * 1.8);
            
            ctx.save();
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            
            let color = '255, 255, 255'; 
            if (trade.side === 'buy') color = '0, 255, 127';
            else if (trade.side === 'sell') color = '255, 69, 58';
            
            const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
            grad.addColorStop(0, `rgba(${color}, 0.7)`);   
            grad.addColorStop(0.6, `rgba(${color}, 0.3)`); 
            grad.addColorStop(1, `rgba(${color}, 0.05)`);  
            
            ctx.fillStyle = grad;
            ctx.strokeStyle = `rgba(${color}, 0.9)`;
            ctx.lineWidth = 2;
            
            ctx.shadowBlur = theme === 'dark' ? 15 : 8;
            ctx.shadowColor = `rgba(${color}, 0.6)`;
            
            ctx.fill();
            ctx.stroke();

            if (radius > 12) {
                ctx.shadowBlur = 0;
                ctx.fillStyle = '#FFFFFF';
                ctx.font = 'bold 11px Inter, sans-serif';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(trade.size.toString(), x, y);
            }
            ctx.restore();
        });
    };

    // 🧪 Usando datos REALES de Rithmic (Test inyectado anteriormente eliminado)
    useEffect(() => {
        const handleResize = () => {
            const canvas = canvasRef.current;
            const container = canvas?.parentElement;
            if (canvas && container) {
                canvas.width = container.clientWidth;
                canvas.height = container.clientHeight;
                render();
            }
        };

        handleResize();
        window.addEventListener('resize', handleResize);
        
        let requestRef: number;
        let lastXRange = '';
        let lastYCoordinate = 0;

        const animate = () => {
            if (!enabled) return;
            const timeScale = chart.timeScale();
            const range = JSON.stringify(timeScale.getVisibleLogicalRange());
            const lastTrade = trades[trades.length - 1];
            const yCoord = series.priceToCoordinate(lastTrade?.price || 0) || 0;

            if (range !== lastXRange || yCoord !== lastYCoordinate) {
                render();
                lastXRange = range;
                lastYCoordinate = yCoord;
            }
            requestRef = requestAnimationFrame(animate);
        };

        requestRef = requestAnimationFrame(animate);

        const unsubStore = (useStore as any).subscribe((state: any, prevState: any) => {
            if (state.bigTradesData !== prevState.bigTradesData || 
                state.orderFlowStrategies.bigTrades !== prevState.orderFlowStrategies.bigTrades || 
                state.minTradeSize !== prevState.minTradeSize ||
                state.serverOffset !== prevState.serverOffset ||
                state.theme !== prevState.theme) {
                render();
            }
        });

        return () => {
            window.removeEventListener('resize', handleResize);
            if (requestRef) cancelAnimationFrame(requestRef);
            if (typeof unsubStore === 'function') unsubStore();
        };
    }, [chart, enabled, theme, trades.length, minSize, timeframe, currentSymbol, serverOffset]);

    return (
        <div className="absolute top-0 left-0 w-full h-full pointer-events-none" style={{ zIndex: 10 }}>
            <canvas
                ref={canvasRef}
                className="absolute inset-0 pointer-events-none"
                style={{ width: '100%', height: '100%' }}
            />
        </div>
    );
};

export default BigTradesOverlay;

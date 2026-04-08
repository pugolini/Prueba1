import React, { useEffect, useRef } from 'react';
import { IChartApi, ISeriesApi, Time } from 'lightweight-charts';
import { useStore, BigTrade } from '../../store/useStore';

interface BigTradesProps {
    chart: IChartApi;
    series: ISeriesApi<"Candlestick">;
}

export const BigTradesOverlay: React.FC<BigTradesProps> = ({ chart, series }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const enabled = useStore(s => s.orderFlowStrategies.bigTrades);
    const trades = useStore(s => s.bigTradesData);
    const theme = useStore(s => s.theme);

    const render = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        if (!enabled || trades.length === 0) return;

        const timeScale = chart.timeScale();
        const timeframe = useStore.getState().timeframe;
        
        let tfSeconds = 60;
        if (timeframe.includes('m')) tfSeconds = parseInt(timeframe) * 60;
        else if (timeframe.includes('h')) tfSeconds = parseInt(timeframe) * 3600;
        else if (timeframe.includes('d')) tfSeconds = 86400;

        trades.forEach((trade: BigTrade) => {
            const snappedTime = Math.floor(trade.time / tfSeconds) * tfSeconds;
            const x = timeScale.timeToCoordinate(snappedTime as Time);
            const y = series.priceToCoordinate(trade.price);
            
            if (x === null || y === null) return;
            if (x < 0 || x > canvas.width || y < 0 || y > canvas.height) return;

            // Radio profesional basado en raíz cuadrada (escala de área)
            const radius = Math.sqrt(trade.size) * 1.6;
            
            ctx.save();
            ctx.beginPath();
            ctx.arc(x, y, radius, 0, Math.PI * 2);
            
            if (trade.side === 'buy') {
                // Gradiente "Crystal" verde
                const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
                grad.addColorStop(0, 'rgba(0, 255, 127, 0.5)');
                grad.addColorStop(1, 'rgba(0, 255, 127, 0.1)');
                ctx.fillStyle = grad;
                ctx.strokeStyle = 'rgba(0, 255, 127, 0.8)';
            } else {
                // Gradiente "Crystal" rojo
                const grad = ctx.createRadialGradient(x, y, 0, x, y, radius);
                grad.addColorStop(0, 'rgba(255, 69, 58, 0.5)');
                grad.addColorStop(1, 'rgba(255, 69, 58, 0.1)');
                ctx.fillStyle = grad;
                ctx.strokeStyle = 'rgba(255, 69, 58, 0.8)';
            }
            
            ctx.lineWidth = 1.2;
            ctx.fill();
            ctx.stroke();

            // Etiqueta de tamaño simplificada para trades grandes
            if (radius > 10) {
                ctx.fillStyle = theme === 'dark' ? 'white' : 'black';
                ctx.font = '500 9px Inter';
                ctx.textAlign = 'center';
                ctx.fillText(trade.size.toString(), x, y + 3);
            }
            ctx.restore();
        });
    };

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
        
        // 🟢 Bucle de renderizado de alta performance (60fps sincronizado)
        // Esto soluciona el lag al arrastrar el eje de precios (Y)
        let requestRef: number;
        let lastXRange = '';
        let lastYCoordinate = 0;

        const animate = () => {
            if (!enabled) return;

            // Optimización: Solo redibujar si la escala ha cambiado
            const timeScale = chart.timeScale();
            const range = JSON.stringify(timeScale.getVisibleLogicalRange());
            // Usamos el coordinate de un precio fijo para detectar scale/pan en Y
            const yCoord = series.priceToCoordinate(trades[0]?.price || 0) || 0;

            if (range !== lastXRange || yCoord !== lastYCoordinate) {
                render();
                lastXRange = range;
                lastYCoordinate = yCoord;
            }
            requestRef = requestAnimationFrame(animate);
        };

        requestRef = requestAnimationFrame(animate);

        // Suscripción al store para cambios de datos (independiente del movimiento)
        const unsubStore = (useStore as any).subscribe((state: any, prevState: any) => {
            if (state.bigTradesData !== prevState.bigTradesData || state.orderFlowStrategies.bigTrades !== prevState.orderFlowStrategies.bigTrades || state.theme !== prevState.theme) {
                render();
            }
        });

        return () => {
            window.removeEventListener('resize', handleResize);
            if (requestRef) cancelAnimationFrame(requestRef);
            if (typeof unsubStore === 'function') unsubStore();
        };
    }, [chart, enabled, theme, trades.length]);

    return (
        <canvas
            ref={canvasRef}
            className="absolute top-0 left-0 w-full h-full pointer-events-none z-20"
        />
    );
};

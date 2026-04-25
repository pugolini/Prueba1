import React, { useEffect, useState } from 'react';
import { IChartApi, ISeriesApi } from 'lightweight-charts';
import { useStore } from '../../store/useStore';
import { X } from 'lucide-react';

interface TradingOverlayProps {
    chart: IChartApi;
    series: ISeriesApi<"Candlestick">;
}

const TradingOverlay: React.FC<TradingOverlayProps> = ({ chart, series }) => {
    const {
        symbol, positions, pendingOrders, closeTradingPosition, modifyTradingOrder, theme,
        isLimitMode, pendingLimitPrice, setPendingLimitPrice,
        pendingSL, setPendingSL, pendingTP, setPendingTP,
        isPendingLimitDragged, setPendingLimitDragged,
        symbolInfo, timeframe, lastTickPrice
    } = useStore();
    
    // 🚀 Performance Optimization: Direct DOM Refs
    const containerRef = React.useRef<HTMLDivElement>(null);
    const labelsRef = React.useRef<Record<string, HTMLDivElement | null>>({});
    const priceTagRef = React.useRef<HTMLDivElement>(null);
    const ghostLimitRef = React.useRef<HTMLDivElement>(null);
    const ghostSLRef = React.useRef<HTMLDivElement>(null);
    const ghostTPRef = React.useRef<HTMLDivElement>(null);

    // Dragging state
    const [dragState, setDragState] = useState<{
        ticket?: number;
        type: 'pos' | 'ord' | 'ghost';
        dragType: 'entry' | 'sl' | 'tp';
        isBuying: boolean;
        entryPrice: number;
        volume: number;
        currentY: number;
    } | null>(null);

    const [currentPrice, setCurrentPrice] = useState<number | null>(null);
    const [candleTimer, setCandleTimer] = useState<string>('');

    // Candle Timer Logic
    useEffect(() => {
        const updateTimer = () => {
            const now = Math.floor(Date.now() / 1000);
            let seconds = 60;
            const unit = timeframe.slice(-1);
            const val = parseInt(timeframe);
            
            if (unit === 'm') seconds = val * 60;
            else if (unit === 'h') seconds = val * 3600;
            else if (unit === 'd') seconds = val * 86400;

            const remaining = seconds - (now % seconds);
            const h = Math.floor(remaining / 3600);
            const m = Math.floor((remaining % 3600) / 60);
            const s = remaining % 60;

            if (h > 0) {
                setCandleTimer(`${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
            } else {
                setCandleTimer(`${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`);
            }
        };

        const timerId = setInterval(updateTimer, 1000);
        updateTimer();
        return () => clearInterval(timerId);
    }, [timeframe]);

    // 🟢 HIGH PERFORMANCE SYNC LOOP (60+ FPS)
    useEffect(() => {
        let rafId: number;

        const syncPositions = () => {
            // 1. Sync Active Positions & Pending Orders
            const allItems = [
                ...positions.map(p => ({ ...p, prefix: 'pos' })),
                ...pendingOrders.map(o => ({ ...o, prefix: 'ord' }))
            ];

            allItems.forEach(item => {
                const baseKey = `${item.prefix}_${item.ticket}`;
                
                // Entry Line / Label
                const el = labelsRef.current[`${baseKey}_entry`];
                if (el) {
                    const y = series.priceToCoordinate(item.price_open);
                    if (y !== null) el.style.transform = `translateY(${y}px)`;
                }

                // SL Line / Label
                const slEl = labelsRef.current[`${baseKey}_sl`];
                if (slEl && item.sl > 0) {
                    const y = series.priceToCoordinate(item.sl);
                    if (y !== null) slEl.style.transform = `translateY(${y}px)`;
                }

                // TP Line / Label
                const tpEl = labelsRef.current[`${baseKey}_tp`];
                if (tpEl && item.tp > 0) {
                    const y = series.priceToCoordinate(item.tp);
                    if (y !== null) tpEl.style.transform = `translateY(${y}px)`;
                }
            });

            // 2. Sync Price Tag (Current Price)
            if (priceTagRef.current && lastTickPrice) {
                const y = series.priceToCoordinate(lastTickPrice);
                if (y !== null) priceTagRef.current.style.transform = `translateY(${y}px)`;
            }

            // 3. Sync Ghost Elements (Limit Mode)
            if (isLimitMode) {
                if (ghostLimitRef.current && pendingLimitPrice) {
                    const y = series.priceToCoordinate(pendingLimitPrice);
                    if (y !== null) ghostLimitRef.current.style.transform = `translateY(${y}px)`;
                }
                if (ghostSLRef.current && pendingSL) {
                    const y = series.priceToCoordinate(pendingSL);
                    if (y !== null) ghostSLRef.current.style.transform = `translateY(${y}px)`;
                }
                if (ghostTPRef.current && pendingTP) {
                    const y = series.priceToCoordinate(pendingTP);
                    if (y !== null) ghostTPRef.current.style.transform = `translateY(${y}px)`;
                }
            }

            rafId = requestAnimationFrame(syncPositions);
        };

        rafId = requestAnimationFrame(syncPositions);
        return () => cancelAnimationFrame(rafId);
    }, [positions, pendingOrders, series, lastTickPrice, isLimitMode, pendingLimitPrice, pendingSL, pendingTP]);

    const handleMouseDown = (e: React.MouseEvent, item: any, type: 'pos' | 'ord' | 'ghost', dragType: 'entry' | 'sl' | 'tp' = 'entry') => {
        e.preventDefault();
        let entryPriceVal = 0;
        let isBuyingVal = true;
        let volumeVal = useStore.getState().defaultLot;

        if (type === 'ghost') {
            entryPriceVal = pendingLimitPrice || 0;
            isBuyingVal = true;
            setPendingLimitDragged(true);
        } else {
            entryPriceVal = item.price_open;
            isBuyingVal = item.type.includes('BUY');
            volumeVal = item.volume;
        }

        setDragState({
            ticket: item?.ticket,
            type: type,
            dragType: dragType,
            isBuying: isBuyingVal,
            entryPrice: entryPriceVal,
            volume: volumeVal,
            currentY: e.clientY
        });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!dragState) return;
        const rect = e.currentTarget.getBoundingClientRect();
        const y = e.clientY - rect.top;
        const price = series.coordinateToPrice(y);
        if (price) setCurrentPrice(price);
    };

    const handleMouseUp = () => {
        if (!dragState || !currentPrice) {
            setDragState(null);
            setCurrentPrice(null);
            return;
        }

        if (dragState.type === 'ghost') {
            if (dragState.dragType === 'entry') setPendingLimitPrice(currentPrice);
            else if (dragState.dragType === 'sl') setPendingSL(currentPrice);
            else if (dragState.dragType === 'tp') setPendingTP(currentPrice);
        } else if (dragState.type === 'pos' || dragState.type === 'ord') {
            const ticket = dragState.ticket!;
            const isPos = dragState.type === 'pos';
            const item = isPos 
                ? useStore.getState().positions.find(p => p.ticket === ticket)
                : useStore.getState().pendingOrders.find(o => o.ticket === ticket);

            if (item) {
                let newSL = item.sl;
                let newTP = item.tp;
                let newPrice = item.price_open;

                if (dragState.dragType === 'sl') {
                    newSL = currentPrice;
                } else if (dragState.dragType === 'tp') {
                    newTP = currentPrice;
                } else if (dragState.dragType === 'entry') {
                    if (isPos) {
                        // Dragging entry line of a real position -> Create SL or TP
                        const isBuy = item.type.includes('BUY');
                        if (isBuy) {
                            if (currentPrice > item.price_open) newTP = currentPrice;
                            else newSL = currentPrice;
                        } else {
                            if (currentPrice < item.price_open) newTP = currentPrice;
                            else newSL = currentPrice;
                        }
                    } else {
                        // Dragging entry line of a limit order -> Move the order
                        newPrice = currentPrice;
                    }
                }

                modifyTradingOrder(ticket, newSL, newTP, !isPos ? newPrice : undefined);
            }
        }

        setDragState(null);
        setCurrentPrice(null);
    };

    const renderPnl = (price: number, entry: number, isBuy: boolean, volume: number) => {
        const tickSize = symbolInfo?.tickSize || 0.01;
        const tickValue = symbolInfo?.tickValue || 0.01;
        const diff = (price - entry) * (isBuy ? 1 : -1);
        const pnl = (diff / tickSize) * tickValue * volume;
        if (isNaN(pnl)) return '...';
        return (pnl >= 0 ? '+' : '') + `$${pnl.toFixed(2)}`;
    };

    return (
        <div
            className={`absolute inset-0 ${dragState ? 'pointer-events-auto cursor-ns-resize' : 'pointer-events-none'} overflow-hidden`}
            style={{ zIndex: 10 }}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
        >
            {/* Render Ghost Line for Limit Order Creation */}
            {isLimitMode && pendingLimitPrice && (
                    <div 
                        ref={ghostLimitRef}
                        className="absolute right-24 flex items-center pointer-events-auto z-50 group font-sans transition-transform duration-0 ease-linear"
                        style={{ top: 0 }}
                    >
                        <div 
                            className="flex-1 border-t border-dashed border-[#2962ff]/40 cursor-ns-resize mr-4" 
                            style={{ width: '40px' }}
                            onMouseDown={(e) => handleMouseDown(e, null, 'ghost', 'entry')}
                        />
                        
                        {/* SL/TP Poker Handles */}
                        <div className="flex items-center gap-1.5 mr-3">
                            <div 
                                className="px-1.5 h-5 bg-[#ff9800]/10 border border-[#ff9800]/30 rounded-none flex items-center justify-center cursor-ns-resize hover:bg-[#ff9800] hover:text-white text-[#ff9800] text-[9px] font-bold transition-all backdrop-blur-sm"
                                onMouseDown={(e) => {
                                    if (!pendingSL) setPendingSL(pendingLimitPrice * 0.999);
                                    handleMouseDown(e, null, 'ghost', 'sl');
                                }}
                            >
                                SL
                            </div>
                            <div 
                                className="px-1.5 h-5 bg-[#089981]/10 border border-[#089981]/30 rounded-none flex items-center justify-center cursor-ns-resize hover:bg-[#089981] hover:text-white text-[#089981] text-[9px] font-bold transition-all backdrop-blur-sm"
                                onMouseDown={(e) => {
                                    if (!pendingTP) setPendingTP(pendingLimitPrice * 1.001);
                                    handleMouseDown(e, null, 'ghost', 'tp');
                                }}
                            >
                                TP
                            </div>
                        </div>

                        <div 
                            className="flex items-center h-[22px] rounded-[4px] border border-[#2962FF] bg-[#2962FF] text-white backdrop-blur-sm overflow-hidden"
                            onMouseDown={(e) => handleMouseDown(e, null, 'ghost', 'entry')}
                        >
                            <div className="px-2 h-full flex items-center justify-center text-[10px] font-bold border-r border-white/20">
                                {useStore.getState().defaultLot}
                            </div>
                            <div className="px-3 flex items-center gap-2 text-[10px] font-bold min-w-[80px]">
                                {!isPendingLimitDragged && (
                                    <div className="w-1.5 h-1.5 bg-white rounded-none animate-pulse shadow-[0_0_5px_white]" />
                                )}
                                LÍMITE {pendingLimitPrice.toFixed(2)}
                            </div>
                            <div className="px-1.5 h-full flex items-center justify-center border-l border-white/20">
                                <X size={10} />
                            </div>
                        </div>
                    </div>
            )}

            {/* Ghost SL/TP Lines */}
            {isLimitMode && pendingSL && (
                <div 
                    ref={ghostSLRef}
                    className="absolute right-0 flex items-center pointer-events-auto cursor-ns-resize z-40 transition-transform duration-0 ease-linear"
                    style={{ top: 0, left: 0 }}
                    onMouseDown={(e) => handleMouseDown(e, null, 'ghost', 'sl')}
                >
                    <div className="flex-1 border-t border-dotted border-[#ff9800]" />
                    <div className="px-2 py-0.5 border border-dashed border-[#ff9800] bg-[#ff9800]/10 text-[#ff9800] text-[9px] font-bold rounded-[4px] mr-[150px] backdrop-blur-sm whitespace-nowrap">
                        SL {pendingSL.toFixed(2)} ({renderPnl(pendingSL, pendingLimitPrice || 0, true, useStore.getState().defaultLot)})
                    </div>
                </div>
            )}
            {isLimitMode && pendingTP && (
                <div 
                    ref={ghostTPRef}
                    className="absolute right-0 flex items-center pointer-events-auto cursor-ns-resize z-40 transition-transform duration-0 ease-linear"
                    style={{ top: 0, left: 0 }}
                    onMouseDown={(e) => handleMouseDown(e, null, 'ghost', 'tp')}
                >
                    <div className="flex-1 border-t border-dotted border-[#009688]" />
                    <div className="px-2 py-0.5 border border-dashed border-[#009688] bg-[#009688]/10 text-[#009688] text-[9px] font-bold rounded-[4px] mr-[150px] backdrop-blur-sm whitespace-nowrap">
                        TP {pendingTP.toFixed(2)} ({renderPnl(pendingTP, pendingLimitPrice || 0, true, useStore.getState().defaultLot)})
                    </div>
                </div>
            )}

            {/* Position / Order Labels (PILL STYLE) */}
            {[...positions.map(p => ({...p, prefix: 'pos'})), ...pendingOrders.map(o => ({...o, prefix: 'ord'}))].map((data) => {
                const isPos = data.prefix === 'pos';
                const ticket = data.ticket;
                const ticketKey = `${data.prefix}_${ticket}`;

                if (!data) return null;
                const isCurrentlyDragging = dragState?.ticket === ticket;

                return (
                    <React.Fragment key={ticketKey}>
                        <div
                            ref={el => labelsRef.current[`${ticketKey}_entry`] = el}
                            className="absolute right-24 flex items-center gap-0 pointer-events-auto cursor-grab active:cursor-grabbing group font-sans transition-transform duration-0 ease-linear"
                            style={{ top: 0 }}
                            onMouseDown={(e) => handleMouseDown(e, data, isPos ? 'pos' : 'ord')}
                        >
                            {/* Etiqueta de Precio en Eje Y (Derecha) */}
                            <div 
                                className="absolute right-[-246px] -translate-y-1/2 px-1.5 py-0.5 text-[11px] font-bold text-white z-50 pointer-events-none min-w-[60px] text-center"
                                style={{ 
                                    backgroundColor: isPos 
                                        ? ((data as any).profit >= 0 ? '#009688' : '#f23645')
                                        : '#2962FF'
                                }}
                            >
                                {data.price_open.toFixed(2)}
                            </div>

                            <div className={`flex items-center h-[22px] rounded-[4px] border overflow-hidden backdrop-blur-sm transition-all ${
                                isPos
                                    ? ((data as any).profit >= 0 
                                        ? 'border-[#009688] bg-[#009688]/10 text-[#009688]' 
                                        : 'border-[#f23645] bg-[#f23645]/10 text-[#f23645]')
                                    : 'border-[#2962FF] bg-[#2962FF] text-white'
                            } ${isCurrentlyDragging ? 'ring-2 ring-white/20' : ''}`}>
                                
                                {/* Sección 1: Lote */}
                                <div className={`px-2 h-full flex items-center justify-center text-[10px] font-bold border-r ${
                                    isPos
                                        ? ((data as any).profit >= 0 ? 'border-[#009688]' : 'border-[#f23645]')
                                        : 'border-white/20'
                                }`}>
                                    {data.volume}
                                </div>

                                {/* Sección 2: Cuerpo (PnL/Texto) */}
                                <div className="px-3 flex items-center gap-1.5 min-w-[80px]">
                                    {isPos && (data as any).profit !== undefined ? (
                                        <span className="text-[10px] font-bold">
                                            {(data as any).profit >= 0 ? '+' : ''}{(data as any).profit.toFixed(2)} USD
                                        </span>
                                    ) : (
                                        <span className="text-[10px] font-bold uppercase tracking-tight">
                                            {data.type === 'BUY' ? 'Límite Compra' : 'Límite Venta'}
                                        </span>
                                    )}
                                </div>

                                {/* Sección 3: Botón de Cierre */}
                                <button
                                    onClick={(e) => { e.stopPropagation(); closeTradingPosition(ticket); }}
                                    className={`h-full px-1.5 flex items-center justify-center border-l transition-all hover:bg-white/10 ${
                                        isPos
                                            ? ((data as any).profit >= 0 ? 'border-[#009688]' : 'border-[#f23645]')
                                            : 'border-white/20'
                                    }`}
                                >
                                    <X size={10} />
                                </button>
                            </div>
                            
                            {/* Connector Line */}
                            <div className={`w-32 border-t border-dashed ${
                                isPos ? (data.type === 'BUY' ? 'border-[#2962ff]/30' : 'border-[#f23645]/30') : 'border-gray-500/30'
                            }`} />
                        </div>

                        {/* Dashed Lines for SL/TP */}
                        {data.sl > 0 && (
                            <div 
                                ref={el => labelsRef.current[`${ticketKey}_sl`] = el}
                                className="absolute left-0 right-0 pointer-events-none transition-transform duration-0 ease-linear" 
                                style={{ top: 0 }}
                            >
                                <div className="w-full border-t border-dotted border-rose-500/20" />
                                <div className="absolute right-0 w-[246px] border-t border-dotted border-[#ff9800]" />
                                <div 
                                    className="absolute right-[246px] -translate-y-1/2 px-1.5 py-0.5 bg-[#ff9800] text-white text-[11px] font-bold z-50 min-w-[60px] text-center pointer-events-none"
                                >
                                    {data.sl.toFixed(2)}
                                </div>
                                <div 
                                    className="absolute right-[310px] -translate-y-1/2 flex items-center h-[18px] rounded-[4px] border border-dashed border-[#ff9800] bg-[#ff9800]/10 text-[#ff9800] backdrop-blur-sm pointer-events-auto cursor-ns-resize overflow-hidden"
                                    onMouseDown={(e) => handleMouseDown(e, data, isPos ? 'pos' : 'ord', 'sl')}
                                >
                                    <div className="px-1.5 h-full flex items-center justify-center text-[9px] font-bold border-r border-dashed border-[#ff9800]">
                                        SL
                                    </div>
                                    <div className="px-2 text-[9px] font-bold whitespace-nowrap">
                                        {renderPnl(data.sl, data.price_open, data.type.includes('BUY'), data.volume)}
                                    </div>
                                </div>
                            </div>
                        )}
                        {data.tp > 0 && (
                            <div 
                                ref={el => labelsRef.current[`${ticketKey}_tp`] = el}
                                className="absolute left-0 right-0 pointer-events-none transition-transform duration-0 ease-linear" 
                                style={{ top: 0 }}
                            >
                                <div className="w-full border-t border-dotted border-emerald-500/20" />
                                <div className="absolute right-0 w-[246px] border-t border-dotted border-[#009688]" />
                                <div 
                                    className="absolute right-[246px] -translate-y-1/2 px-1.5 py-0.5 bg-[#009688] text-white text-[11px] font-bold z-50 min-w-[60px] text-center pointer-events-none"
                                >
                                    {data.tp.toFixed(2)}
                                </div>
                                <div 
                                    className="absolute right-[310px] -translate-y-1/2 flex items-center h-[18px] rounded-[4px] border border-dashed border-[#009688] bg-[#009688]/10 text-[#009688] backdrop-blur-sm pointer-events-auto cursor-ns-resize overflow-hidden"
                                    onMouseDown={(e) => handleMouseDown(e, data, isPos ? 'pos' : 'ord', 'tp')}
                                >
                                    <div className="px-1.5 h-full flex items-center justify-center text-[9px] font-bold border-r border-dashed border-[#009688]">
                                        TP
                                    </div>
                                    <div className="px-2 text-[9px] font-bold whitespace-nowrap">
                                        {renderPnl(data.tp, data.price_open, data.type.includes('BUY'), data.volume)}
                                    </div>
                                </div>
                            </div>
                        )}
                    </React.Fragment>
                );
            })}

            {/* Drag Preview */}
            {dragState && currentPrice && (
                <div className="absolute left-0 right-0 pointer-events-none flex items-center z-[100]" style={{ top: series.priceToCoordinate(currentPrice) || 0 }}>
                    <div className="flex-1 border-t-2 border-blue-400 border-dashed opacity-40 shadow-[0_0_10px_rgba(59,130,246,0.3)]" />
                    <div className="px-3 py-1 bg-[#2962ff] text-white text-[10px] font-black rounded-full shadow-2xl flex items-center gap-2 border border-white/20">
                        <span>{dragState.dragType.toUpperCase()} ➔ {currentPrice.toFixed(2)}</span>
                        {dragState.dragType !== 'entry' && (
                            <span className="bg-white/20 px-2 py-0.5 rounded-full">
                                {renderPnl(currentPrice, dragState.entryPrice, dragState.isBuying, dragState.volume)}
                            </span>
                        )}
                    </div>
                </div>
            )}
            {/* Candle Timer (Posicionado arriba del eje temporal y a la izquierda del eje de precios) */}
            <div className="absolute bottom-[30px] right-[65px] z-50 pointer-events-none">
                <div className="bg-black/80 backdrop-blur-sm border border-white/10 px-2 py-0.5 rounded-[2px] min-w-[50px] text-center shadow-xl">
                    <span className="text-white text-[10px] font-mono font-medium tracking-tight">
                        {candleTimer}
                    </span>
                </div>
            </div>
        </div>
    );
};

export default TradingOverlay;

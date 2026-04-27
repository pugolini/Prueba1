import React, { useEffect, useRef, useState, useMemo } from 'react'; // PUGOBOT-SYNC-V14.2.1
import { createChart, ColorType, ISeriesApi, Time, LineStyle, IChartApi, ISeriesPrimitive } from 'lightweight-charts';
import { useStore, BigTrade } from '../../store/useStore';
import { useShallow } from 'zustand/react/shallow';
import { shallow } from 'zustand/shallow';
import { DiamondPrimitive } from './plugins/DiamondPrimitive';
import { OrderFlowAnalyzer } from '../../engine/orderflow/OrderFlowAnalyzer';
import axios from 'axios';
import OrderTicket from '../Sidebar/OrderTicket';
import { executeVortexJS } from '../../engine/vortexEngine';
import { FootprintChart } from '../footprint/FootprintChart';
import { StorageManager, Tick } from '../../engine/footprint/StorageManager';
import { POCEngine } from '../../engine/footprint/POCEngine';
import FootprintOverlay from './FootprintOverlay';
import OrderFlowStrategiesOverlay from './OrderFlowStrategiesOverlay';
import { BigTradesOverlay } from './BigTradesOverlay';
import { HeatmapOverlay } from './BookmapOverlay';
import TradingOverlay from './TradingOverlay';
import SessionZonesOverlay from './SessionZonesOverlay';
import PositionsPanel from './PositionsPanel';
import { TrendlinePrimitive } from './plugins/TrendlinePrimitive';
import { RectanglePrimitive } from './plugins/RectanglePrimitive';
import { FibonacciPrimitive } from './plugins/FibonacciPrimitive';
import { PositionPrimitive } from './plugins/PositionPrimitive';
import { DrawingToolbar } from './DrawingToolbar';
import { AnchoredVwapPrimitive } from './plugins/AnchoredVwapPrimitive';
import { DeltaTotalsPrimitive } from './plugins/DeltaTotalsPrimitive';
import DeltaLevelsOverlay from './DeltaLevelsOverlay';

const ChartComponent: React.FC = () => {
    const chartContainerRef = useRef<HTMLDivElement>(null);
    const subChartContainerRef = useRef<HTMLDivElement>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const subChartRef = useRef<IChartApi | null>(null);
    const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
    const subSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
    const diamondPrimitiveRef = useRef<DiamondPrimitive | null>(null);
    const analyzerRef = useRef<OrderFlowAnalyzer>(new OrderFlowAnalyzer(0.25));
    const lastPriceRef = useRef<number>(0); 
    const lastAggressorRef = useRef<'bid' | 'ask'>('ask');
    const isCalibratedRef = useRef(false);
    const pineSeriesRef = useRef<{ [key: string]: ISeriesApi<'Line'>[] }>({});
    const drawingsRef = useRef<Record<string, any>>({}); 
    const tempDrawingRef = useRef<{ id: string, type: string, points: any[], plugin: any } | null>(null);
    const pocEngineRef = useRef<POCEngine>(new POCEngine());
    const deltaMarkersPersistRef = useRef<Map<number, any>>(new Map());
    const lastUpdateRef = useRef<number>(0);
    const lastDataLengthRef = useRef<number>(0);
    const indicatorMarkersRef = useRef<any[]>([]);
    const lastDeltaUpdateRef = useRef<number>(0);
    const priceLinesRef = useRef<Record<string, any[]>>({});
    const deltaTotalsPrimitiveRef = useRef<DeltaTotalsPrimitive>(new DeltaTotalsPrimitive());
    const [draggingLine, setDraggingLine] = useState<{ ticket: number, type: string, isOrder: boolean } | null>(null);
    const [draggingHandle, setDraggingHandle] = useState<{ id: string, pointIndex: number } | null>(null);
    const [draggingDrawingBody, setDraggingDrawingBody] = useState<{ id: string, startX: number, startY: number, originalPoints: {time: number, price: number}[] } | null>(null);

    // 📏 Estado de Paneles (Resizable) e Interfaz Adaptativa
    const [mainPaneHeight, setMainPaneHeight] = useState(70);
    const [isResizing, setIsResizing] = useState(false);
    const [showDetailedMarkers, setShowDetailedMarkers] = useState(true);
    const [isChartReady, setIsChartReady] = useState(false);

    const symbol         = useStore(s => s.symbol);
    const timeframe      = useStore(s => s.timeframe);
    const theme          = useStore(s => s.theme);
    const activeTool     = useStore(s => s.activeTool);
    const serverOffset   = useStore(s => s.serverOffset);
    const chartRange     = useStore(s => s.chartRange);
    
    // Sincronización optimizada: Solo re-renderizar cuando cambia la LONGITUD (nueva vela),
    // no por cada cambio de precio (update de la última vela).
    const dataLength     = useStore(s => s.data.length);
    const dataRef        = useRef<Bar[]>(useStore.getState().data);
    const isFootprintEnabled     = useStore(s => s.isFootprintEnabled);
    const isOrderTicketOpen      = useStore(s => s.isOrderTicketOpen);
    const positions              = useStore(s => s.positions);
    const pendingOrders          = useStore(s => s.pendingOrders);
    const lastTickPrice          = useStore(s => s.lastTickPrice);
    const defaultLot             = useStore(s => s.defaultLot);
    const pineIndicators         = useStore(s => s.pineIndicators);
    const selectedDrawingId      = useStore(s => s.selectedDrawingId);
    const selectedAnchoredVwapId = useStore(s => s.selectedAnchoredVwapId);
    const dashboardData          = useStore(s => s.dashboardData);
    const drawingsBySymbol       = useStore(s => s.drawingsBySymbol);
    const anchoredVwapsBySymbol  = useStore(s => s.anchoredVwapsBySymbol);
    const footprintData          = useStore(s => s.footprintData);
    const indicators             = useStore(s => s.indicators);
    const isLimitMode            = useStore(s => s.isLimitMode);
    const pendingLimitPrice      = useStore(s => s.pendingLimitPrice);
    const isPendingLimitDragged  = useStore(s => s.isPendingLimitDragged);
    const strategySignals        = useStore(s => s.strategySignals);
    const sessionZonesData       = useStore(s => s.sessionZonesData);
    const showPriceLabels        = useStore(s => s.showPriceLabels);

    const {
        setData, setChartRange, setDefaultLot, setActiveTool,
        setSelectedDrawingId, setSelectedAnchoredVwapId,
        addDrawing, removeDrawing, updateDrawing,
        addAnchoredVwap, removeAnchoredVwap, updateAnchoredVwap,
        fetchTradingStatus, modifyTradingOrder, closeTradingPosition,
        setDashboardData, setIsLoadingFootprint,
        injectHistoricalFootprint, setPendingLimitPrice
    } = useStore(s => ({
        setData: s.setData, setChartRange: s.setChartRange, setDefaultLot: s.setDefaultLot,
        setActiveTool: s.setActiveTool, setSelectedDrawingId: s.setSelectedDrawingId,
        setSelectedAnchoredVwapId: s.setSelectedAnchoredVwapId,
        addDrawing: s.addDrawing, removeDrawing: s.removeDrawing, updateDrawing: s.updateDrawing,
        addAnchoredVwap: s.addAnchoredVwap, removeAnchoredVwap: s.removeAnchoredVwap,
        updateAnchoredVwap: s.updateAnchoredVwap,
        fetchTradingStatus: s.fetchTradingStatus,
        modifyTradingOrder: s.modifyTradingOrder,
        closeTradingPosition: s.closeTradingPosition,
        setDashboardData: s.setDashboardData,
        setIsLoadingFootprint: s.setIsLoadingFootprint,
        injectHistoricalFootprint: s.injectHistoricalFootprint,
        setPendingLimitPrice: s.setPendingLimitPrice
    }), shallow);

    const currentDrawings = useMemo(() => drawingsBySymbol[symbol] || [], [drawingsBySymbol, symbol]);
    const currentAnchoredVwaps = useMemo(() => anchoredVwapsBySymbol[symbol] || [], [anchoredVwapsBySymbol, symbol]);

    // 1. Initial Chart & Series Setup
    useEffect(() => {
        if (!chartContainerRef.current || !subChartContainerRef.current) return;

        const isDark = theme === 'dark';
        const bgColor = '#999999'; // Deepcharts Neutral Gray
        const textColor = '#000000'; // Contrast for gray background
        const gridColor = 'rgba(0, 0, 0, 0.08)'; // Subtle dark grid
        const borderColor = 'rgba(0, 0, 0, 0.15)'; 

        // ═══════════════════════════════════════════════════════
        // CHART PRINCIPAL (VELAS)
        // ═══════════════════════════════════════════════════════
        const chart = createChart(chartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: bgColor },
                textColor: textColor,
                fontSize: 11,
                fontFamily: "'Inter', sans-serif",
            },
            localization: {
                locale: 'es-ES',
                timeFormatter: (timestamp: number) => {
                    return new Intl.DateTimeFormat('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false,
                        timeZone: 'Europe/Madrid'
                    }).format(new Date(timestamp * 1000));
                },
            },
            grid: {
                vertLines: { color: gridColor, style: LineStyle.SparseDotted },
                horzLines: { color: gridColor, style: LineStyle.SparseDotted },
            },
            crosshair: {
                mode: 1,
                vertLine: { width: 1, color: '#212121', style: LineStyle.LargeDashed, labelBackgroundColor: '#212121' },
                horzLine: { width: 1, color: '#212121', style: LineStyle.LargeDashed, labelBackgroundColor: '#212121' },
            },
            timeScale: {
                borderColor: borderColor,
                timeVisible: true,
                secondsVisible: false,
                rightOffset: 15,
                barSpacing: 6,
                minBarSpacing: 0.5,
                tickMarkFormatter: (timestamp: number) => {
                    return new Intl.DateTimeFormat('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                        hour12: false,
                        timeZone: 'Europe/Madrid'
                    }).format(new Date(timestamp * 1000));
                },
            },
            rightPriceScale: {
                borderColor: borderColor,
                autoScale: true,
                scaleMargins: { top: 0.1, bottom: 0.1 },
            },
        });

        const series = chart.addCandlestickSeries({
            upColor: '#757575',   // Gris más claro (Bull)
            downColor: '#000000', // Negro (Bear)
            borderVisible: true,
            borderColor: '#000000',
            borderUpColor: '#000000',
            borderDownColor: '#000000',
            wickVisible: true,
            wickColor: '#000000',
            wickUpColor: '#000000',
            wickDownColor: '#000000',
            priceLineColor: '#757575', // Etiqueta de precio gris
            lastValueVisible: useStore.getState().showPriceLabels,
        });
        
        const diamondPrimitive = new DiamondPrimitive();
        series.attachPrimitive(diamondPrimitive);
        diamondPrimitiveRef.current = diamondPrimitive;

        chartRef.current = chart;
        // Adjuntar el motor de totales Delta mejorado
        deltaTotalsPrimitiveRef.current.setDataRef(dataRef);
        series.attachPrimitive(deltaTotalsPrimitiveRef.current);
        
        seriesRef.current = series;

        // ═══════════════════════════════════════════════════════
        // CHART SECUNDARIO (CVD / INDICADORES)
        // ═══════════════════════════════════════════════════════
        const subChart = createChart(subChartContainerRef.current, {
            layout: {
                background: { type: ColorType.Solid, color: bgColor },
                textColor: textColor,
                fontSize: 11,
            },
            localization: {
                locale: 'es-ES',
                timeFormatter: (timestamp: number) => {
                    return new Intl.DateTimeFormat('es-ES', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: false,
                        timeZone: 'Europe/Madrid'
                    }).format(new Date(timestamp * 1000));
                },
            },
            grid: {
                vertLines: { color: gridColor, style: LineStyle.SparseDotted },
                horzLines: { color: gridColor, style: LineStyle.SparseDotted },
            },
            timeScale: {
                visible: false, // El tiempo lo marca el de arriba
            },
            rightPriceScale: {
                borderColor: borderColor,
                autoScale: true,
                scaleMargins: { top: 0.1, bottom: 0.1 },
            }
        });
        subChartRef.current = subChart;

        // Inicializar serie para el sub-gráfico (CVD / Esqueleto Sincro)
        const subSeries = subChart.addLineSeries({
            color: '#2962ff',
            lineWidth: 2,
            priceScaleId: 'right',
        });
        subSeriesRef.current = subSeries;

        // ═══════════════════════════════════════════════════════
        // SINCRONIZACIÓN MILIMÉTRICA
        // ═══════════════════════════════════════════════════════
        
        let isSyncing = false;

        // Sincronización MILIMÉTRICA por Rango Lógico (Guardia de Seguridad Pugobot v3)
        // Usar LogicalRange evita el jitter y el zoom infinito en gráficos multi-panel.
        chart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
            if (isSyncing || !range) return;
            try {
                isSyncing = true;
                subChart.timeScale().setVisibleLogicalRange(range);
                
                // --- DETECTOR DE ZOOM PARA DELTAS --- 
                const spacing = chart.timeScale().options().barSpacing || 0;
                setShowDetailedMarkers(prev => {
                    if (spacing < 6 && prev) return false;   // Ocultar solo si está muy comprimido
                    if (spacing >= 8 && !prev) return true;  // Mostrar si hay espacio razonable
                    return prev;
                });

            } catch (e) {
                // Recover
            } finally {
                isSyncing = false;
            }
        });

        subChart.timeScale().subscribeVisibleLogicalRangeChange((range) => {
            if (isSyncing || !range || !chartRef.current) return;
            try {
                isSyncing = true;
                chart.timeScale().setVisibleLogicalRange(range);
            } catch (e) {
            } finally {
                isSyncing = false;
            }
        });

        // Sincronización de Crosshair
        chart.subscribeCrosshairMove((param) => {
            if (isSyncing) return;
            isSyncing = true;
            if (!param.point) {
                subChart.setCrosshairPosition(null, null, null as any);
            } else {
                subChart.setCrosshairPosition(0, param.time as any, null as any);
            }
            isSyncing = false;
        });

        subChart.subscribeCrosshairMove((param) => {
            if (isSyncing) return;
            isSyncing = true;
            if (!param.point) {
                chart.setCrosshairPosition(null, null, null as any);
            } else {
                chart.setCrosshairPosition(0, param.time as any, null as any);
            }
            isSyncing = false;
        });

        // 📌 MOTOR DE MARCADORES DELTA (Normalización de Timestamps)
        const updateDeltaMarkers = (timestamp: number, delta: number) => {
            if (!seriesRef.current) return;
            
            const state = useStore.getState();
            const serverOffset = state.serverOffset || 0;
            const timeframeStr = state.timeframe || '1m';
            const tfMatch = timeframeStr.match(/(\d+)([mhdw])/);
            let tfSeconds = 60;
            if (tfMatch) {
                const val = parseInt(tfMatch[1]);
                const unit = tfMatch[2];
                if (unit === 'm') tfSeconds = val * 60;
                else if (unit === 'h') tfSeconds = val * 3600;
                else if (unit === 'd') tfSeconds = val * 86400;
            }

            const rawSec = timestamp > 2000000000 ? Math.floor(timestamp / 1000) : Math.floor(timestamp);
            
            // Bucket Time: Alineamos al inicio del timeframe (ej. cada minuto exacto)
            const bucketTime = Math.floor(rawSec / tfSeconds) * tfSeconds;

            const isPos = delta >= 0;
            const deltaStr = (isPos ? '+' : '') + Math.round(delta).toLocaleString();

            deltaMarkersPersistRef.current.set(bucketTime, {
                time: bucketTime,
                delta: delta 
            });

            // Sincronizar con el primitivo visual
            deltaTotalsPrimitiveRef.current.deltaMarkers.set(bucketTime, { delta });
            deltaTotalsPrimitiveRef.current.theme = theme;
            deltaTotalsPrimitiveRef.current.updateAllViews();
            series.applyOptions({}); // Forzar redibujado de la serie

            // 🚀 ACTUALIZACIÓN EN TIEMPO REAL: Refrescar marcadores inmediatamente
            // Throttling de 250ms para no saturar el renderizado en ticks rápidos
            const now = Date.now();
            if (now - lastDeltaUpdateRef.current > 250) {
                lastDeltaUpdateRef.current = now;
                refreshMarkers();
            }
        };

        const refreshMarkers = () => {
            if (!seriesRef.current) return;
            
            const currentData = dataRef.current;
            const finalMarkerMap = new Map<string, any>();
            
            const getBestTime = (markerTime: number) => {
                if (currentData.length === 0) return Math.floor(markerTime);
                let bestT = currentData[0].time as number;
                for (let i = currentData.length - 1; i >= 0; i--) {
                    const candTime = currentData[i].time as number;
                    if (candTime <= markerTime) {
                        bestT = candTime;
                        break;
                    }
                }
                return bestT;
            };

            // 1. Marcadores de indicadores (VortexJS/Pine)
            indicatorMarkersRef.current.forEach(m => {
                const t = getBestTime(Number(m.time));
                const key = `${t}_${m.position}`;
                finalMarkerMap.set(key, { ...m, time: t as Time });
            });

            // 2. Marcadores Delta (Ahora gestionados por DeltaTotalsPrimitive para mejor visibilidad)
            // Ya no añadimos marcadores nativos para Delta para evitar duplicidad y mejorar limpieza
            deltaTotalsPrimitiveRef.current.theme = theme;
            deltaTotalsPrimitiveRef.current.updateAllViews();

            const finalMarkers = Array.from(finalMarkerMap.values())
                .sort((a, b) => (a.time as number) - (b.time as number));
                
            seriesRef.current.setMarkers(finalMarkers);
        };

        (chart as any)._updateDelta = updateDeltaMarkers;
        (chart as any)._refreshMarkers = refreshMarkers;
        (chart as any)._clearDeltas = () => {
            deltaMarkersPersistRef.current.clear();
            seriesRef.current?.setMarkers([]);
        };

        // Resize Handling
        const handleResize = () => {
            if (chartContainerRef.current && chart) {
                chart.resize(chartContainerRef.current.clientWidth, chartContainerRef.current.clientHeight);
            }
            if (subChartContainerRef.current && subChart) {
                subChart.resize(subChartContainerRef.current.clientWidth, subChartContainerRef.current.clientHeight);
            }
        };

        const resizeObserver = new ResizeObserver(() => handleResize());
        resizeObserver.observe(chartContainerRef.current);
        if (subChartContainerRef.current) resizeObserver.observe(subChartContainerRef.current);

        window.addEventListener('resize-chart', handleResize);

        return () => {
            if (resizeObserver) resizeObserver.disconnect();
            window.removeEventListener('resize-chart', handleResize);
            if (chartRef.current) chartRef.current.remove();
            if (subChartRef.current) subChartRef.current.remove();
            chartRef.current = null;
            seriesRef.current = null;
            subChartRef.current = null;
            subSeriesRef.current = null;
            diamondPrimitiveRef.current = null;
            subChartRef.current = null;
            setIsChartReady(false);
        };
    }, [theme]);

    useEffect(() => {
        if (chartRef.current && seriesRef.current) {
            setIsChartReady(true);
        }
    }, [theme]);

    // 📏 Lógica de Redimensionamiento
    useEffect(() => {
        if (!isResizing) return;

        const handleMouseMove = (e: MouseEvent) => {
            if (!chartContainerRef.current?.parentElement) return;
            const parentRect = chartContainerRef.current.parentElement.getBoundingClientRect();
            const relativeY = e.clientY - parentRect.top;
            const newHeight = (relativeY / parentRect.height) * 100;
            
            // Límites de seguridad (20% - 80%)
            if (newHeight > 20 && newHeight < 80) {
                setMainPaneHeight(newHeight);
            }
        };

        const handleMouseUp = () => {
            setIsResizing(false);
        };

        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isResizing]);

    // Activador de resize forzado al cambiar el tamaño de los paneles
    useEffect(() => {
        if (chartRef.current && subChartRef.current && chartContainerRef.current && subChartContainerRef.current) {
            chartRef.current.resize(chartContainerRef.current.clientWidth, chartContainerRef.current.clientHeight);
            subChartRef.current.resize(subChartContainerRef.current.clientWidth, subChartContainerRef.current.clientHeight);
        }
    }, [mainPaneHeight]);


    // 🟢 El WebSocket Institucional ahora se maneja de forma consolidada más abajo
    // para evitar duplicidad en el procesamiento de ticks y deltas.
    
    useEffect(() => {
        return () => {
            const state = useStore.getState();
            state.clearOrderFlowData();
        };
    }, [symbol]);

    useEffect(() => {
        if (seriesRef.current) {
            // 🧹 LIMPIEZA ATÓMICA DE SERIES (Visual)
            // Esto mata la "vela fantasma" instantáneamente antes de que llegue el historial.
            seriesRef.current?.setData([]);
            subSeriesRef.current?.setData([]);
            lastPriceRef.current = 0; // Reset memoria de precio
            
            console.log(`[Chart] Limpieza visual ejecutada para ${symbol}`);
        }
        // Limpiamos referencias de precio para que el primer tick no se compare con el anterior
        lastPriceRef.current = 0;
    }, [symbol]);

    // 🟢 WebSocket de Precios (MT5 Principal)
    useEffect(() => {
        if (chartRef.current && chartContainerRef.current) {
            const chart = chartRef.current;
            const container = chartContainerRef.current;
            const resize = () => {
                chart.resize(container.clientWidth, container.clientHeight);
                if (subChartRef.current && subChartContainerRef.current) {
                    subChartRef.current.resize(subChartContainerRef.current.clientWidth, subChartContainerRef.current.clientHeight);
                }
            };
            resize();
            setTimeout(resize, 50);
            setTimeout(resize, 300);
        }
    }, [isOrderTicketOpen]);

    // 2. Poll Trading Status periodically
    useEffect(() => {
        if (!symbol) return;
        const interval = setInterval(() => fetchTradingStatus(), 3000);
        fetchTradingStatus();
        return () => clearInterval(interval);
    }, [symbol, fetchTradingStatus]);

    // 3. Render Trading Lines (Entry, SL, TP)
    useEffect(() => {
        if (!seriesRef.current || !chartRef.current) return;
        const series = seriesRef.current;

        const activeTicketsArray = [
            ...positions.map(p => `pos_${p.ticket}`),
            ...pendingOrders.map(o => `ord_${o.ticket}`)
        ];
        const activeTickets = new Set(activeTicketsArray);

        // Limpiar líneas de tickets cerrados
        Object.keys(priceLinesRef.current).forEach(key => {
            if (!activeTickets.has(key)) {
                priceLinesRef.current[key].forEach(l => series.removePriceLine(l));
                delete priceLinesRef.current[key];
            }
        });

        const createOrUpdateLine = (ticketKey: string, type: string, price: number, color: string, title: string) => {
            if (price <= 0) return;
            if (!priceLinesRef.current[ticketKey]) priceLinesRef.current[ticketKey] = [];
            
            let line = priceLinesRef.current[ticketKey].find((l: any) => l._type === type);
            if (line) {
                line.applyOptions({ price, title, color });
            } else {
                line = series.createPriceLine({
                    price,
                    color,
                    lineWidth: 2,
                    lineStyle: LineStyle.Solid,
                    axisLabelVisible: true,
                    title: title,
                });
                (line as any)._type = type;
                (line as any)._ticketKey = ticketKey;
                priceLinesRef.current[ticketKey].push(line);
            }
        };

        positions.forEach(p => {
            const key = `pos_${p.ticket}`;
            const color = p.type === 'BUY' ? '#089981' : '#f23645';
            createOrUpdateLine(key, 'price', p.price_open, color, `${p.type} ${p.volume} (#${p.ticket})`);
            if (p.sl > 0) createOrUpdateLine(key, 'sl', p.sl, '#f23645', `SL`);
            if (p.tp > 0) createOrUpdateLine(key, 'tp', p.tp, '#089981', `TP`);
        });

        pendingOrders.forEach(o => {
            const key = `ord_${o.ticket}`;
            const color = '#2962ff';
            createOrUpdateLine(key, 'price', o.price_open, color, `${o.type} ${o.volume} (#${o.ticket})`);
            if (o.sl > 0) createOrUpdateLine(key, 'sl', o.sl, '#f23645', `SL`);
            if (o.tp > 0) createOrUpdateLine(key, 'tp', o.tp, '#089981', `TP`);
        });
    }, [positions, pendingOrders]);
    
    // 5. Native Signal Primitive Engine (V5 Solid)
    useEffect(() => {
        if (!diamondPrimitiveRef.current) return;
        diamondPrimitiveRef.current.setSignals(strategySignals);
    }, [strategySignals]);

    // 5. Drawing Rendering Engine (Reactive with Primitives API)
    useEffect(() => {
        if (!chartRef.current || !seriesRef.current) return;
        const series = seriesRef.current;

        // Limpiar dibujos eliminados
        const currentIds = currentDrawings.map((d: any) => d.id);
        Object.keys(drawingsRef.current).forEach((id: string) => {
            if (!currentIds.includes(id)) {
                const plugin = drawingsRef.current[id];
                if (plugin && chartRef.current) {
                    try { series.detachPrimitive(plugin); } catch (e) {
                        console.warn('[Chart] Failed to detach primitive:', e);
                    }
                }
                delete drawingsRef.current[id];
            }
        });

        // Dibujar/Actualizar cada dibujo
        currentDrawings.forEach((d: any) => {
            let plugin = drawingsRef.current[d.id];
            
            const isSelected = d.id === selectedDrawingId;
            const activeColor = d.color || '#2962ff';
            const activeTextColor = d.textColor || activeColor; // Por defecto el mismo de la línea
            const activeWidth = d.lineWidth || 2;

            if (!plugin) {
                if (d.type === 'trendline') {
                    plugin = new TrendlinePrimitive(d.points, { color: activeColor, width: activeWidth, style: d.lineStyle, text: d.text, textColor: activeTextColor });
                } else if (d.type === 'rectangle') {
                    plugin = new RectanglePrimitive(d.points, { 
                        color: activeColor, 
                        width: activeWidth, 
                        fillColor: d.fillColor || activeColor, 
                        fillOpacity: d.fillOpacity ?? 0.1,
                        extendRight: d.extendRight || false,
                        text: d.text, 
                        textColor: activeTextColor 
                    });
                } else if (d.type === 'fibonacci') {
                    plugin = new FibonacciPrimitive(d.points, { color: activeColor, width: activeWidth });
                } else if (d.type === 'long' || d.type === 'short') {
                    plugin = new PositionPrimitive(d.type, d.points, { color: activeColor, width: activeWidth });
                }
                if (plugin) {
                    plugin.selected = isSelected;
                    series.attachPrimitive(plugin);
                    drawingsRef.current[d.id] = plugin;
                }
            } else {
                // Actualizar Parámetros
                plugin.points = d.points;
                plugin.parameters = { 
                    ...plugin.parameters, 
                    color: activeColor, 
                    textColor: activeTextColor,
                    width: activeWidth,
                    style: d.lineStyle,
                    text: d.text,
                    fillColor: d.fillColor || activeColor,
                    fillOpacity: d.fillOpacity ?? 0.1,
                    extendRight: d.extendRight || false
                };
                plugin.selected = isSelected;
                plugin.updateAllViews();
            }
        });
    }, [currentDrawings, selectedDrawingId]);

    // 4. Drag & Interaction Engine Logic
    useEffect(() => {
        if (!chartContainerRef.current || !chartRef.current || !seriesRef.current) return;
        const container = chartContainerRef.current;
        const chart = chartRef.current;
        const series = seriesRef.current;

        const getChartTime = (x: number) => {
            const currentData = dataRef.current;
            if (!chart || currentData.length === 0) return null;
            const timeScale = chart.timeScale();
            let t = timeScale.coordinateToTime(x);
            if (t === null) {
                const logical = timeScale.coordinateToLogical(x);
                if (logical !== null) {
                    const lastData = currentData[currentData.length - 1];
                    const lastLogical = currentData.length - 1;
                    const diff = logical - lastLogical;
                    let interval = 60;
                    if (currentData.length >= 2) {
                        interval = (currentData[currentData.length-1].time as number) - (currentData[currentData.length-2].time as number);
                    }
                    return (lastData.time as number) + (diff * interval);
                }
            }
            return typeof t === 'number' ? t : (t as any)?.timestamp || null;
        };

        const handleMouseDown = (e: MouseEvent) => {
            const rect = container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;

            // 🚀 INTERACCIÓN CON EJE DE PRECIOS (Click en Etiquetas de Zonas)
            const priceScaleWidth = chart.priceScale('right').width();
            if (x > (container.clientWidth - priceScaleWidth)) {
                const priceAtY = series.coordinateToPrice(y);
                if (priceAtY !== null && sessionZonesData) {
                    const zones = sessionZonesData;
                    const zoneEntries = [
                        { price: zones.overnight?.high, label: 'ON High' },
                        { price: zones.overnight?.low, label: 'ON Low' },
                        { price: zones.rth?.poc, label: 'POC' },
                        { price: zones.rth?.vah, label: 'VAH' },
                        { price: zones.rth?.val, label: 'VAL' },
                        { price: zones.initial_balance?.high, label: 'IBH' },
                        { price: zones.initial_balance?.low, label: 'IBL' },
                        { price: zones.prev_day?.poc, label: 'pPOC' },
                        { price: zones.prev_day?.high, label: 'PDH' },
                        { price: zones.prev_day?.low, label: 'PDL' },
                    ].filter(z => z.price != null);

                    let closestZone = null;
                    let minPixelDist = 20; // Tolerancia generosa para el label

                    zoneEntries.forEach(z => {
                        const zY = series.priceToCoordinate(z.price!);
                        if (zY !== null) {
                            const dist = Math.abs(zY - y);
                            if (dist < minPixelDist) {
                                minPixelDist = dist;
                                closestZone = z;
                            }
                        }
                    });

                    if (closestZone) {
                        // 1. COMPORTAMIENTO TOGGLE: Buscar por etiqueta exacta (es lo más fiable)
                        const existingDrawing = currentDrawings.find(d => 
                            d.type === 'rectangle' && 
                            d.text === closestZone!.label
                        );

                        if (existingDrawing) {
                            removeDrawing(existingDrawing.id);
                            return;
                        }

                        // 2. DETERMINAR ANCLAJE DE TIEMPO SEGÚN LA ZONA
                        let startTime = zones.rth?.start_time || (dataRef.current[0]?.time as number);
                        if (closestZone.label.startsWith('ON')) {
                            startTime = zones.overnight?.start_time || startTime;
                        } else if (closestZone.label.startsWith('p') || closestZone.label.startsWith('PD')) {
                            // Zonas previas: Anclamos al inicio de los datos disponibles para dar perspectiva
                            startTime = dataRef.current[0]?.time as number;
                        }

                        // 3. CREACIÓN CON CENTRADO Y MAYOR GROSOR
                        const pY = series.priceToCoordinate(closestZone.price!);
                        if (pY !== null) {
                            const pTop = series.coordinateToPrice(pY - 10) || closestZone.price!;
                            const pBottom = series.coordinateToPrice(pY + 10) || closestZone.price!;

                            addDrawing({
                                type: 'rectangle',
                                points: [
                                    { time: startTime, price: pTop },
                                    { time: startTime + 3600, price: pBottom }
                                ],
                                color: 'transparent',
                                lineWidth: 0,
                                fillColor: theme === 'dark' ? '#D1D1D1' : '#666666',
                                fillOpacity: 0.12,
                                extendRight: true,
                                text: closestZone.label,
                                textColor: theme === 'dark' ? '#CCCCCC' : '#333333'
                            });
                        }
                        return;
                    }
                }
            }

            const ts = getChartTime(x);
            const price = series.coordinateToPrice(y);
            
            if (price === null || ts === null) return;

            if (activeTool === 'cursor') {
                const timeScale = chart.timeScale();

                // 1. Prioridad: Punto Central
                const drawingWithCenterHit = currentDrawings.find(d => {
                    if (d.points.length < 2) return false;
                    const p1X = timeScale.timeToCoordinate(d.points[0].time as Time);
                    const p1Y = series.priceToCoordinate(d.points[0].price);
                    const p2X = timeScale.timeToCoordinate(d.points[1].time as Time);
                    const p2Y = series.priceToCoordinate(d.points[1].price);
                    if (p1X === null || p1Y === null || p2X === null || p2Y === null) return false;
                    
                    const centerX = (p1X + p2X) / 2;
                    const centerY = (p1Y + p2Y) / 2;
                    const distC = Math.sqrt(Math.pow(x - centerX, 2) + Math.pow(y - centerY, 2));
                    return distC < 35;
                });

                if (drawingWithCenterHit) {
                    setSelectedDrawingId(drawingWithCenterHit.id);
                    if (!drawingWithCenterHit.isLocked) {
                        setDraggingDrawingBody({
                            id: drawingWithCenterHit.id,
                            startX: x,
                            startY: y,
                            originalPoints: JSON.parse(JSON.stringify(drawingWithCenterHit.points))
                        });
                        chart.applyOptions({ handleScroll: false, handleScale: false });
                    }
                    return;
                }

                // 2. Extremos
                if (selectedDrawingId) {
                    const drawing = currentDrawings.find(d => d.id === selectedDrawingId);
                    if (drawing && !drawing.isLocked && drawing.points.length >= 2) {
                        const p1X = timeScale.timeToCoordinate(drawing.points[0].time as Time);
                        const p1Y = series.priceToCoordinate(drawing.points[0].price);
                        const p2X = timeScale.timeToCoordinate(drawing.points[1].time as Time);
                        const p2Y = series.priceToCoordinate(drawing.points[1].price);

                        if (p1X !== null && p1Y !== null && p2X !== null && p2Y !== null) {
                            const dist1 = Math.sqrt(Math.pow(x - p1X, 2) + Math.pow(y - p1Y, 2));
                            const dist2 = Math.sqrt(Math.pow(x - p2X, 2) + Math.pow(y - p2Y, 2));

                            if (dist1 < 25) {
                                setDraggingHandle({ id: selectedDrawingId, pointIndex: 0 });
                                chart.applyOptions({ handleScroll: false, handleScale: false });
                                return;
                            } else if (dist2 < 25) {
                                setDraggingHandle({ id: selectedDrawingId, pointIndex: 1 });
                                chart.applyOptions({ handleScroll: false, handleScale: false });
                                return;
                            }
                        }
                    }
                }

                // 3. Selección por Cuerpo
                const clickedDrawing = currentDrawings.find(d => {
                    const p = drawingsRef.current[d.id];
                    if (!p || d.points.length < 2) return false;
                    const p1X = timeScale.timeToCoordinate(d.points[0].time as Time);
                    const p1Y = series.priceToCoordinate(d.points[0].price);
                    const p2X = timeScale.timeToCoordinate(d.points[1].time as Time);
                    const p2Y = series.priceToCoordinate(d.points[1].price);
                    if (p1X === null || p1Y === null || p2X === null || p2Y === null) return false;

                    if (d.type === 'trendline') {
                        const A = x - p1X; const B = y - p1Y; const C = p2X - p1X; const D = p2Y - p1Y;
                        const dot = A * C + B * D; const lenSq = C * C + D * D;
                        let param = lenSq !== 0 ? dot / lenSq : -1;
                        let xx, yy;
                        if (param < 0) { xx = p1X; yy = p1Y; } else if (param > 1) { xx = p2X; yy = p2Y; } else { xx = p1X + param * C; yy = p1Y + param * D; }
                        return Math.sqrt(Math.pow(x - xx, 2) + Math.pow(y - yy, 2)) < 15;
                    } else {
                        const xMin = Math.min(p1X, p2X); const xMax = Math.max(p1X, p2X);
                        const yMin = Math.min(p1Y, p2Y); const yMax = Math.max(p1Y, p2Y);
                        return (x >= xMin && x <= xMax && y >= yMin && y <= yMax);
                    }
                });
                
                if (clickedDrawing) {
                    setSelectedDrawingId(clickedDrawing.id);
                    return;
                } else {
                    setSelectedDrawingId(null);
                }

                const clickedVwap = (currentAnchoredVwaps || []).find(v => {
                    const xV = timeScale.timeToCoordinate(v.startTime as Time);
                    if (xV === null) return false;
                    const candle = dataRef.current.find(d => (d.time as number) === v.startTime);
                    if (!candle) return false;
                    const yV = series.priceToCoordinate(candle.high);
                    if (yV === null) return false;
                    return Math.sqrt(Math.pow(x - xV, 2) + Math.pow(y - yV, 2)) < 25;
                });
                if (clickedVwap) {
                    setSelectedAnchoredVwapId(clickedVwap.id);
                    return;
                } else {
                    setSelectedAnchoredVwapId(null);
                }
            }

            const drawingTools = ['trendline', 'rectangle', 'fibonacci', 'long', 'short'];
            if (drawingTools.includes(activeTool)) {
                const initialPoints = [{ time: ts, price: price }, { time: ts, price: price }];
                const tempId = 'temp_' + Math.random();
                const previewColor = theme === 'dark' ? '#ffffff' : '#000000';
                let plugin: any = null;
                if (activeTool === 'trendline') plugin = new TrendlinePrimitive(initialPoints, { color: previewColor, width: 3, style: LineStyle.Solid });
                else if (activeTool === 'rectangle') plugin = new RectanglePrimitive(initialPoints, { color: previewColor, width: 3, fillColor: 'rgba(255,255,255,0.1)' });
                else if (activeTool === 'fibonacci') plugin = new FibonacciPrimitive(initialPoints, { color: previewColor, width: 2 });
                else if (activeTool === 'long' || activeTool === 'short') plugin = new PositionPrimitive(activeTool as 'long' | 'short', initialPoints, { color: previewColor, width: 2 });

                if (plugin) {
                    series.attachPrimitive(plugin);
                    tempDrawingRef.current = { id: tempId, type: activeTool, points: initialPoints, plugin };
                    chart.applyOptions({ handleScroll: false, handleScale: false });
                }
                return;
            }

            if (activeTool === 'anchoredVwap') {
                const index = dataRef.current.findIndex(d => (d.time as number) >= ts);
                if (index !== -1) {
                    addAnchoredVwap({ startTime: ts, startIndex: index, color: theme === 'dark' ? '#2962ff' : '#2196f3', lineWidth: 2 });
                    setActiveTool('cursor');
                }
                return;
            }

            let closest: any = null;
            let minDist = 15;
            Object.values(priceLinesRef.current).flat().forEach((line: any) => {
                const lineY = series.priceToCoordinate(line.options().price);
                if (lineY !== null) {
                    const dist = Math.abs(lineY - y);
                    if (dist < minDist) { minDist = dist; closest = line; }
                }
            });
            if (closest) {
                const ticket = parseInt(closest._ticketKey.split('_')[1]);
                setDraggingLine({ ticket, type: closest._type, isOrder: closest._ticketKey.startsWith('ord_') });
                chart.applyOptions({ handleScroll: false, handleScale: false });
            }
        };

        const handleMouseMove = (e: MouseEvent) => {
            const rect = container.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            const ts = getChartTime(x);
            const price = series.coordinateToPrice(y);
            if (price === null || ts === null) return;

            const getSnappedPrice = (p: number, t: number) => {
                if (!e.ctrlKey) return p;
                const candle = dataRef.current.find(d => (d.time as number) === (t as number));
                if (!candle) return p;
                const dH = Math.abs(p - candle.high), dL = Math.abs(p - candle.low), dO = Math.abs(p - candle.open), dC = Math.abs(p - candle.close);
                const minV = Math.min(dH, dL, dO, dC);
                if (minV === dH) return candle.high; if (minV === dL) return candle.low; if (minV === dO) return candle.open; return candle.close;
            };

            if (draggingDrawingBody) {
                const plugin = drawingsRef.current[draggingDrawingBody.id];
                if (plugin) {
                    const timeScale = chart.timeScale();
                    const sP = series.coordinateToPrice(draggingDrawingBody.startY), cP = series.coordinateToPrice(y);
                    const sL = timeScale.coordinateToLogical(draggingDrawingBody.startX), cL = timeScale.coordinateToLogical(x);
                    if (sP !== null && cP !== null && sL !== null && cL !== null) {
                        const priceDelta = cP - sP, logicalDelta = Math.round(cL - sL);
                        plugin.points = draggingDrawingBody.originalPoints.map(p => {
                            const pX = timeScale.timeToCoordinate(p.time as Time);
                            const pL = pX !== null ? timeScale.coordinateToLogical(pX) : null;
                            const nX = pL !== null ? timeScale.logicalToCoordinate((pL + logicalDelta) as any) : null;
                            return { time: (nX !== null ? getChartTime(nX) : p.time) as number, price: p.price + priceDelta };
                        });
                        plugin.updateAllViews(); series.applyOptions({});
                    }
                }
                return;
            }

            if (tempDrawingRef.current) {
                const temp = tempDrawingRef.current;
                temp.points[1] = { time: ts as number, price: getSnappedPrice(price as number, ts as number) };
                if (temp.plugin) { temp.plugin.points = [...temp.points]; temp.plugin.updateAllViews(); series.applyOptions({}); }
                return;
            }

            if (draggingHandle) {
                const plugin = drawingsRef.current[draggingHandle.id];
                if (plugin) {
                    plugin.points[draggingHandle.pointIndex] = { time: ts as number, price: getSnappedPrice(price as number, ts as number) };
                    plugin.updateAllViews(); series.applyOptions({});
                }
                return;
            }

            if (draggingLine) {
                const step = price > 10000 ? 5 : (price > 1000 ? 1 : (price > 100 ? 0.05 : 0.01));
                const roundedPrice = Math.round(price / step) * step;
                const key = draggingLine.isOrder ? `ord_${draggingLine.ticket}` : `pos_${draggingLine.ticket}`;
                const line = priceLinesRef.current[key]?.find((l: any) => l._type === draggingLine.type);
                if (line) line.applyOptions({ price: roundedPrice });
            }
        };

        const handleMouseUp = async (e: MouseEvent) => {
            if (tempDrawingRef.current) {
                const rect = container.getBoundingClientRect();
                const ts = getChartTime(e.clientX - rect.left);
                const price = series.coordinateToPrice(e.clientY - rect.top);
                const temp = tempDrawingRef.current;
                if (ts !== null && price !== null) temp.points[1] = { time: ts, price };
                if (Math.abs(temp.points[0].time - temp.points[1].time) > 0 || Math.abs(temp.points[0].price - temp.points[1].price) > 0.1) {
                    const baseColor = theme === 'dark' ? '#2962ff' : '#2196f3';
                    const extraProps = temp.type === 'rectangle' ? { fillColor: baseColor, fillOpacity: 0.1 } : {};
                    addDrawing({ 
                        type: temp.type as any, 
                        points: temp.points, 
                        color: baseColor, 
                        lineWidth: 2, 
                        lineStyle: 0,
                        ...extraProps
                    });
                }
                if (temp.plugin) series.detachPrimitive(temp.plugin);
                tempDrawingRef.current = null; chart.applyOptions({ handleScroll: true, handleScale: true });
                setActiveTool('cursor');
                return;
            }

            if (draggingLine) {
                const rect = container.getBoundingClientRect();
                const price = series.coordinateToPrice(e.clientY - rect.top);
                if (price !== null) {
                    const step = price > 10000 ? 5 : (price > 1000 ? 1 : (price > 100 ? 0.05 : 0.01));
                    const finalPrice = Math.round(price / step) * step;
                    if (draggingLine.type === 'sl') await modifyTradingOrder(draggingLine.ticket, finalPrice, 0);
                    else if (draggingLine.type === 'tp') await modifyTradingOrder(draggingLine.ticket, 0, finalPrice);
                    else if (draggingLine.isOrder && draggingLine.type === 'price') await modifyTradingOrder(draggingLine.ticket, 0, 0, finalPrice);
                }
                chart.applyOptions({ handleScroll: true, handleScale: true });
                setDraggingLine(null);
            }

            if (draggingHandle) {
                const plugin = drawingsRef.current[draggingHandle.id];
                if (plugin) updateDrawing(draggingHandle.id, { points: [...plugin.points] });
                setDraggingHandle(null); chart.applyOptions({ handleScroll: true, handleScale: true });
            }

            if (draggingDrawingBody) {
                const plugin = drawingsRef.current[draggingDrawingBody.id];
                if (plugin) updateDrawing(draggingDrawingBody.id, { points: [...plugin.points] });
                setDraggingDrawingBody(null); chart.applyOptions({ handleScroll: true, handleScale: true });
            }
        };

        const handleKeyDown = (e: KeyboardEvent) => {
            const state = useStore.getState();
            if (e.key === 'Delete' || e.key === 'Backspace') {
                if (state.selectedDrawingId) state.removeDrawing(state.selectedDrawingId);
                else if (state.selectedAnchoredVwapId) state.removeAnchoredVwap(state.selectedAnchoredVwapId);
            }
            if (e.ctrlKey && e.key.toLowerCase() === 'c' && state.selectedDrawingId) state.copyDrawing(state.selectedDrawingId);
            if (e.ctrlKey && e.key.toLowerCase() === 'v') state.pasteDrawing();
        };

        container.addEventListener('mousedown', handleMouseDown);
        window.addEventListener('mousemove', handleMouseMove);
        window.addEventListener('mouseup', handleMouseUp);
        window.addEventListener('keydown', handleKeyDown);

        return () => {
            container.removeEventListener('mousedown', handleMouseDown);
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, [draggingLine, draggingHandle, draggingDrawingBody, modifyTradingOrder, activeTool, currentAnchoredVwaps, addAnchoredVwap, setActiveTool, setSelectedDrawingId, selectedDrawingId, addDrawing, setSelectedDrawingId, selectedDrawingId, currentDrawings, theme, sessionZonesData]);

    // Control de flujo y recuperación de errores
    const lastFetchTimeRef = useRef<number>(0);
    const failedTimestampsRef = useRef<Set<number>>(new Set());

    useEffect(() => {
        if (!isFootprintEnabled || !symbol || !timeframe || !chartRef.current) return;

        const chart = chartRef.current;
        const timeScale = chart.timeScale();

        const fetchFootprint = async (toTimestamp?: number) => {
            const now = Date.now();
            
            // 1. Throttling: Máximo 1 petición cada 3s (v11.5) para dar aire a Rithmic
            if (now - lastFetchTimeRef.current < 3000) return;
            
            // 2. Blacklist: Si falló recientemente para este timestamp, abortar
            if (toTimestamp && failedTimestampsRef.current.has(toTimestamp)) {
                console.warn(`[Footprint] Skipping blacklisted timestamp: ${toTimestamp}`);
                return;
            }

            if (useStore.getState().isLoadingFootprint) return;
            
            useStore.getState().setIsLoadingFootprint(true);
            lastFetchTimeRef.current = now;

            try {
                const url = `http://127.0.0.1:8000/api/footprint/${symbol}?timeframe=${timeframe}&count=80000${toTimestamp ? `&to_timestamp=${toTimestamp}` : ''}`;
                const response = await axios.get(url, { timeout: 15000 });
                
                const dataCount = response.data ? Object.keys(response.data).length : 0;
                console.log(`[Footprint] Recibidos ${dataCount} niveles de historial.`);

                if (dataCount > 0) {
                    useStore.getState().injectHistoricalFootprint(response.data);
                    if (toTimestamp) failedTimestampsRef.current.delete(toTimestamp);
                } else if (toTimestamp) {
                    // Si pedimos datos ANTERIORES a un punto y no vienen nada, es el fin del historial
                    console.log(`[Footprint] Fin de historial alcanzado en ${toTimestamp}. Blacklisting permanente.`);
                    failedTimestampsRef.current.add(toTimestamp);
                }
            } catch (err) {
                console.error('[Footprint] Error lazy loading:', err);
                
                if (toTimestamp) {
                    failedTimestampsRef.current.add(toTimestamp);
                    // Expira la lista negra en 10 segundos
                    setTimeout(() => failedTimestampsRef.current.delete(toTimestamp!), 10000);
                }
                
                lastFetchTimeRef.current = Date.now() + 2000; 
            } finally {
                 setIsLoadingFootprint(false);
            }
        };

        // Carga inicial
        const currentDataKeys = Object.keys(useStore.getState().footprintData);
        if (currentDataKeys.length === 0) {
            // fetchFootprint(); // B1: Eliminado
        }

        const handleVisibleRangeChange = () => {
            const range = timeScale.getVisibleRange();
            if (!range || !range.from) return;

            const fromTime = typeof range.from === 'number' ? range.from : (range.from as any).timestamp || 0;
            const existingTimes = Object.keys(useStore.getState().footprintData).map(Number).sort((a,b)=>a-b);
            if (existingTimes.length === 0) return;

            const minTimeLoaded = existingTimes[0];
            const timeframeSeconds = timeframe.includes('m') ? parseInt(timeframe)*60 : 3600;

            if (fromTime < minTimeLoaded + (timeframeSeconds * 30)) {
                fetchFootprint(minTimeLoaded);
            }
        };

        timeScale.subscribeVisibleTimeRangeChange(handleVisibleRangeChange);
        return () => timeScale.unsubscribeVisibleTimeRangeChange(handleVisibleRangeChange);
    }, [isFootprintEnabled, symbol, timeframe]);

    // 2. Inicialización de Datos al Montar (v14.0)
    useEffect(() => {
        const state = useStore.getState();
        if (state.symbol && state.data.length === 0) {
            console.log(`[Chart] 🚀 Disparando carga inicial para ${state.symbol}`);
            state.fetchHistoricalFootprint();
        }
    }, []);

    // 3. Sincronización Maestra de Datos (v14.2 - Non-Reactive Subscription)
    useEffect(() => {
        const unsub = useStore.subscribe(
            state => state.data,
            (newData) => {
                const oldData = dataRef.current;
                dataRef.current = newData;

                if (!seriesRef.current || !newData || newData.length === 0) return;

                // Detectar si es una carga de historial o cambio de símbolo (cambio masivo de longitud)
                const isInitialLoad = oldData.length === 0;
                const isHistoryLoad = Math.abs(newData.length - oldData.length) > 2;

                if (isInitialLoad || isHistoryLoad) {
                    console.log(`[Chart] 🔄 Carga masiva (v14.2): Actualizando series con ${newData.length} velas`);
                    seriesRef.current.setData(newData);
                    
                    if (subSeriesRef.current) {
                        subSeriesRef.current.setData(newData.map(d => ({ time: d.time, value: 0 })));
                    }

                    if (isInitialLoad || (newData.length > 0 && newData.length < 2000)) {
                        chartRef.current?.timeScale().fitContent();
                    }
                }
            },
            { fireImmediately: true }
        );

        return unsub;
    }, []);


    // 🔄 LIMPIEZA DE MARCADORES Y CALIBRACIÓN AL CAMBIAR DE SÍMBOLO
    useEffect(() => {
        if (!symbol) return;
        deltaMarkersPersistRef.current.clear();
        isCalibratedRef.current = false; // Forzar recalibración para el nuevo activo
        if (chartRef.current) (chartRef.current as any)._clearDeltas?.();
    }, [symbol, timeframe]);


    // 3. WebSocket Streaming con Reconexión Automática Robusta
    // [CODE BLOCK REMOVED FOR BREVITY IN DIFF]
    
    // 3.5 Sincronización de Etiquetas de Precio
    useEffect(() => {
        if (seriesRef.current) {
            seriesRef.current.applyOptions({
                lastValueVisible: true, // El precio actual siempre visible por petición del usuario
            });
        }
        if (subSeriesRef.current) {
            subSeriesRef.current.applyOptions({
                lastValueVisible: true, // CVD/SubChart siempre visible por petición del usuario
            });
        }
        if (chartRef.current) {
            chartRef.current.applyOptions({
                crosshair: {
                    horzLine: {
                        labelVisible: showPriceLabels,
                    },
                },
            });
        }
        if (subChartRef.current) {
            subChartRef.current.applyOptions({
                crosshair: {
                    horzLine: {
                        labelVisible: showPriceLabels,
                    },
                },
            });
        }
        // Sincronización para indicadores dinámicos (Pine)
        Object.entries(pineSeriesRef.current).forEach(([indId, seriesList]) => {
            const ind = pineIndicators.find(i => i.id === indId);
            seriesList.forEach((s, idx) => {
                const lsTitle = ind?.results?.lineSeries?.[idx]?.title || ' ';
                s.applyOptions({ 
                    lastValueVisible: showPriceLabels,
                    title: showPriceLabels ? lsTitle : ' '
                });
            });
        });
    }, [showPriceLabels, pineIndicators]);

    useEffect(() => {
        if (!symbol) return;
        
        let ws: WebSocket | null = null;
        let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
        let hasCalibrated = false;
        let isEffectActive = true;
        let reconnectAttempt = 0;
        const MAX_RECONNECT_ATTEMPTS = 10;
        
        const getTimeframeSeconds = (tf: string) => {
            const unit = tf.slice(-1);
            const val = parseInt(tf);
            if (unit === 'm') return val * 60;
            if (unit === 'h') return val * 3600;
            if (unit === 'd') return val * 86400;
            return 60;
        };

        // Definir scheduleReconnect primero (será usada por connect)
        const scheduleReconnect = () => {
            if (!isEffectActive) return;
            const delay = Math.min(1000 * Math.pow(2, reconnectAttempt), 30000);
            console.log(`[WS] Reconectando en ${delay}ms...`);
            reconnectTimer = setTimeout(() => {
                if (isEffectActive) connect();
            }, delay);
        };

        const connect = () => {
            if (!isEffectActive) return;
            
            if (reconnectAttempt >= MAX_RECONNECT_ATTEMPTS) {
                console.error(`[WS] Máximo de reconexiones alcanzado para ${symbol}`);
                return;
            }
            
            if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
                console.log(`[WS] Ya existe conexión activa para ${symbol}`);
                return;
            }
            
            try {
                ws = new WebSocket(`ws://127.0.0.1:8000/ws/orderflow/${symbol}`);
                reconnectAttempt++;
                console.log(`[WS] Intentando conectar a ${symbol} (intento ${reconnectAttempt})`);
            } catch (e) {
                console.error(`[WS] Error creando WebSocket:`, e);
                scheduleReconnect();
                return;
            }

            ws.onopen = () => {
                if (!isEffectActive) {
                    ws?.close();
                    return;
                }
                console.log(`[WS] Open for ${symbol}`);
                reconnectAttempt = 0;
            };

            ws.onerror = (err) => {
                console.error(`[WS] Error for ${symbol}:`, err.type);
            };

            ws.onclose = (ev) => {
                console.log(`[WS] Closed for ${symbol} (code=${ev.code}, reason=${ev.reason}, wasClean=${ev.wasClean})`);
                ws = null;
                
                if (isEffectActive && (!ev.wasClean || ev.code === 1006)) {
                    scheduleReconnect();
                }
            };

            ws.onmessage = (event) => {
                if (!isEffectActive) return;
                
                let message;
                try {
                    message = JSON.parse(event.data);
                } catch (e) {
                    console.error('[WS] Error parseando mensaje:', e);
                    return;
                }
                
                const state = useStore.getState();
                const timeframeSeconds = getTimeframeSeconds(state.timeframe);

                // 🔄 AUTO-CALIBRACIÓN DINÁMICA (UTC vs Broker Time)
                if (!hasCalibrated && state.data.length > 0 && message.time) {
                    const lastBar = state.data[state.data.length - 1];
                    const barTime = lastBar.time as number;
                    
                    const messageSymbol = message.symbol || symbol;
                    if (messageSymbol !== symbol) return;

                    const tickTimeSec = (message.time > 2000000000 ? Math.floor(message.time / 1000) : message.time);
                    const expectedBarTime = Math.floor(tickTimeSec / timeframeSeconds) * timeframeSeconds;
                    
                    if (!isCalibratedRef.current) {
                        const calculatedOffset = barTime - expectedBarTime;
                        console.log(`[TimeSync] Initial Calibration: ${calculatedOffset}s`);
                        state.setServerOffset(calculatedOffset);
                        isCalibratedRef.current = true;
                    }
                    hasCalibrated = true;
                }

                // 🟢 Manejar tick_burst, heartbeat o price_update (Rithmic Real-time)
                if (message.type === 'tick_burst' || message.type === 'heartbeat' || message.type === 'price_update') {
                    if (message.type === 'price_update') {
                        console.log(`[WS] price_update recibido: ${message.price}`);
                    }
                    
                    let price = 0;
                    let messageTimeMs = 0;
                    let rawTicks: any[] = [];
                    let volume = 0;

                    if (message.type === 'tick_burst') {
                        rawTicks = message.data;
                        if (!rawTicks || rawTicks.length === 0) return;
                        const lastTick = rawTicks[rawTicks.length - 1];
                        price = lastTick.price;
                        messageTimeMs = lastTick.time || Date.now();
                        volume = rawTicks.reduce((acc: number, t: any) => acc + (t.volume || 1), 0);
                    } else {
                        price = message.price || message.close;
                        messageTimeMs = message.time || Date.now();
                        volume = message.volume || 1;
                    }

                    if (!price || price <= 0) return;

                    const timeframeSeconds = timeframe.includes('m') ? parseInt(timeframe) * 60 : 3600;
                    const normalizedMs = messageTimeMs < 2000000000 ? messageTimeMs * 1000 : messageTimeMs;
                    const tickTimeSec = Math.floor(normalizedMs / 1000);
                    
                    // 🔄 AUTO-CALIBRACIÓN DINÁMICA (UTC vs Broker Time)
                    if (!isCalibratedRef.current && state.data.length > 0) {
                        const lastBar = state.data[state.data.length - 1];
                        const barTime = lastBar.time as number;
                        const expectedBarTime = Math.floor(tickTimeSec / timeframeSeconds) * timeframeSeconds;
                        
                        const calculatedOffset = barTime - expectedBarTime;
                        console.log(`[TimeSync] Initial Calibration: ${calculatedOffset}s`);
                        state.setServerOffset(calculatedOffset);
                        isCalibratedRef.current = true;
                    }

                    const serverOffset = state.serverOffset || 0;
                    const messageTimeSec = tickTimeSec + serverOffset;
                    const candleTime = (Math.floor(messageTimeSec / timeframeSeconds) * timeframeSeconds);

                    // Si el gráfico está vacío, creamos la primera vela para que "cobre vida"
                    if (state.data.length === 0) {
                        console.log(`[Chart] 🚀 Iniciando gráfico vacío con primer tick: ${price}`);
                        const firstBar = {
                            time: candleTime as Time,
                            open: price, high: price, low: price, close: price, volume: volume || 1
                        };
                        state.addBar(firstBar);
                        seriesRef.current?.setData([firstBar]);
                        state.setLastTickPrice(price);
                        return;
                    }

                    const lastBar = state.data[state.data.length - 1];

                    // 🛡️ PRICE SANITY CHECK
                    const priceDiff = Math.abs(price - lastBar.close);
                    if (priceDiff > (lastBar.close * 0.1)) {
                        console.warn(`[Chart] Ignorado tick outlier: ${price} (Último: ${lastBar.close})`);
                        return;
                    }

                    // 🛡️ PROTECCIÓN CONTRA VELAS DEL PASADO (Lightweight Charts Error)
                    if (candleTime < (lastBar.time as number)) {
                        // Si el desfase es pequeño (< 2 bars), lo forzamos a la vela actual para no perder el tick
                        if (Math.abs(candleTime - (lastBar.time as number)) <= timeframeSeconds) {
                            // Update last bar even if slightly behind
                        } else {
                            console.warn(`[Chart] Tick ignorado (tiempo en el pasado): ${candleTime} < ${lastBar.time}`);
                            return;
                        }
                    }

                    // 📦 PROCESAMIENTO DE TICKS (Single o Burst)
                    let currentOpen = lastBar.open;
                    let currentHigh = lastBar.high;
                    let currentLow = lastBar.low;
                    let currentClose = lastBar.close;
                    let currentVol = lastBar.volume || 0;
                    
                    const isNewCandle = candleTime > (lastBar.time as number);
                    if (isNewCandle) {
                        currentOpen = price;
                        currentHigh = price;
                        currentLow = price;
                        currentClose = price;
                        currentVol = 0;
                    }

                    const ticksToProcess = message.type === 'tick_burst' ? rawTicks : [{ price, volume: volume || 1 }];
                    
                    ticksToProcess.forEach((t: any) => {
                        const p = t.price;
                        const v = t.volume || 1;
                        if (p <= 0) return;
                        
                        currentHigh = Math.max(currentHigh, p);
                        currentLow = Math.min(currentLow, p);
                        currentClose = p;
                        currentVol += v;
                    });

                    const updatedBar = {
                        time: (isNewCandle ? candleTime : lastBar.time) as Time,
                        open: currentOpen,
                        high: currentHigh,
                        low: currentLow,
                        close: currentClose,
                        volume: currentVol,
                    };

                    // 🔥 UPDATE CHART & STORE
                    state.addBar(updatedBar);
                    seriesRef.current?.update(updatedBar as any);
                    subSeriesRef.current?.update({ time: updatedBar.time, value: 0 } as any);
                    state.setLastTickPrice(currentClose);
                    
                    if (isNewCandle) console.log(`[Chart] 🕯️ Nueva vela creada: ${new Date(candleTime * 1000).toLocaleTimeString()}`);

                    // Actualizar FOOTPRINT
                    if (state.isFootprintEnabled) {
                        const footprintTicks: any[] = [];
                        if (message.type === 'tick_burst') {
                            const formattedTicks = rawTicks.map((t: any) => {
                                const serverOffset = state.serverOffset || 0;
                                const tTime = t.time || Date.now();
                                const normalizedMs = tTime < 2000000000 ? tTime * 1000 : tTime;

                                let tType: 'bid' | 'ask';
                                const tSide = (t.side || '').toLowerCase();
                                const tLastP = lastPriceRef.current || t.price;

                                if (tSide === 'buy' || tSide === 'ask') tType = 'ask';
                                else if (tSide === 'sell' || tSide === 'bid') tType = 'bid';
                                else if (t.bid && t.price <= t.bid) tType = 'bid';
                                else if (t.ask && t.price >= t.ask) tType = 'ask';
                                else if (t.price < tLastP) tType = 'bid';
                                else if (t.price > tLastP) tType = 'ask';
                                else tType = lastAggressorRef.current;

                                lastAggressorRef.current = tType;
                                lastPriceRef.current = t.price;

                                return {
                                    timestamp: normalizedMs, 
                                    symbol: symbol,
                                    price: t.price,
                                    volume: t.volume || 1,
                                    type: tType
                                };
                            });

                            // Notificar al motor de Footprint y al Store
                            formattedTicks.forEach(tick => {
                                if ((pocEngineRef.current as any).processTick) (pocEngineRef.current as any).processTick(tick);
                            });
                            state.addTicksToFootprint(formattedTicks.map(t => ({
                                time: t.timestamp,
                                price: t.price,
                                volume: t.volume,
                                bid: t.type === 'bid' ? t.price : 0,
                                ask: t.type === 'ask' ? t.price : 0
                            })));
                        } else {
                            
                            const normalizedMs = messageTimeMs < 2000000000 ? messageTimeMs * 1000 : messageTimeMs;
                            
                            let tickType: 'bid' | 'ask';
                            const currentBid = message.bid;
                            const currentAsk = message.ask;
                            const lastP = lastPriceRef.current || state.lastTickPrice || price;

                            const sideStr = (message.side || '').toLowerCase();
                            if (sideStr === 'buy' || sideStr === 'ask') tickType = 'ask';
                            else if (sideStr === 'sell' || sideStr === 'bid') tickType = 'bid';
                            else if (currentBid && price <= currentBid) tickType = 'bid';
                            else if (currentAsk && price >= currentAsk) tickType = 'ask';
                            else if (price < lastP) tickType = 'bid';
                            else if (price > lastP) tickType = 'ask';
                            else tickType = lastAggressorRef.current;

                            lastAggressorRef.current = tickType;
                            lastPriceRef.current = price;

                            const tick: Tick = {
                                timestamp: normalizedMs, 
                                symbol: symbol,
                                price: price,
                                volume: 1,
                                type: tickType
                            };
                            footprintTicks.push(tick);
                            pocEngineRef.current.processTick(tick);
                        }
                        
                        if (footprintTicks.length > 0) {
                            state.addTicksToFootprint(footprintTicks);
                            const lastCandle = pocEngineRef.current.getLatestCandle('1m'); 
                            if (lastCandle && (chartRef.current as any)._updateDelta) {
                                (chartRef.current as any)._updateDelta(lastCandle.timestamp, lastCandle.totalDelta);
                            }
                        }
                    }
                }

                if (message.type === 'big_trade') {
                    state.addBigTrade(message);
                }

                if (message.type === 'heatmap') {
                    const levels = message.data?.length || 0;
                    if (levels > 0) {
                        state.updateHeatmap(message.time, message.data);
                    }
                }
                if (message.type === 'heatmap_history') {
                    if (message.data && message.data.length > 0) {
                        state.setHeatmapHistory(message.data);
                    }
                }

                if (message.type === 'status_update') {
                    if (message.ping) return;
                    if (message.source === 'rithmic') {
                        state.setRithmicConfig({ connected: message.connected });
                    }
                }

                if (message.type === 'error') {
                    console.error('[WS] Error:', message.message);
                }
            };
        };

        // Iniciar conexión
        connect();

        return () => {
            isEffectActive = false;
            if (reconnectTimer) {
                clearTimeout(reconnectTimer);
                reconnectTimer = null;
            }
            if (ws) {
                console.log(`[WS] Cleanup: cerrando conexión para ${symbol}`);
                ws.close(1000, 'Component unmount');
                ws = null;
            }
            isCalibratedRef.current = false;
        };
    }, [symbol]);

    // Herramienta de Diagnóstico para el Subagente/Usuario
    useEffect(() => {
        (window as any).debugFootprint = () => {
            const state = useStore.getState();
            console.log('=== DIAGNÓSTICO FOOTPRINT ===');
            console.log('Símbolo:', symbol);
            console.log('Timeframe:', state.timeframe);
            console.log('Enabled:', state.isFootprintEnabled);
            console.log('Data count:', Object.keys(state.footprintData).length);
            console.log('Last keys:', Object.keys(state.footprintData).slice(-3));
            const lastKey = Number(Object.keys(state.footprintData).slice(-1)[0]);
            console.log('Sample Data:', state.footprintData[lastKey]);
        };
    }, [symbol]);


    // 4. Unified Sync Effect (Candles, Indicators, Markers, Dashboard) - loadHistoricalDelta (doble pegada) ELIMINADO para usar solo rithmic

    useEffect(() => {
        const currentData = dataRef.current;
        if (!chartRef.current || !seriesRef.current || currentData.length === 0) return;

        const isHistoryFetch = Math.abs(currentData.length - (lastDataLengthRef.current || 0)) > 2;
        lastDataLengthRef.current = currentData.length;

        // Throttling: Solo ejecutar scripts si ha pasado > 200ms o es una nueva barra
        const now = Date.now();
        const lastBarTime = currentData[currentData.length - 1].time as number;
        const isNewBar = lastBarTime > (lastUpdateRef.current || 0);
        
        if (!isNewBar && (now - lastUpdateRef.current < 200)) return;
        lastUpdateRef.current = now;

        // A. Limpiar indicadores que ya no existen
        const currentIndIds = pineIndicators.map(i => i.id);
        Object.keys(pineSeriesRef.current).forEach(id => {
            if (!currentIndIds.includes(id)) {
                pineSeriesRef.current[id].forEach(s => chartRef.current?.removeSeries(s));
                delete pineSeriesRef.current[id];
            }
        });

        let allMarkers: any[] = [];
        let combinedDashboard: { [key: string]: string } = {};
        let finalBarColors = new Map<number, string>();

        // 🧠 DEDUPLICACIÓN FINAL DE MARCADORES DELTA
        // Filtramos para asegurar que solo haya un marcador por tiempo de vela
        const deltaMarkersArray = Array.from(deltaMarkersPersistRef.current.values());
        const uniqueDeltaMarkers: any[] = [];
        const seenTimes = new Set<number>();
        
        // Priorizar el marcador más reciente en el mapa
        deltaMarkersArray.reverse().forEach(m => {
            const mTime = m.time as number;
            if (!seenTimes.has(mTime)) {
                uniqueDeltaMarkers.push(m);
                seenTimes.add(mTime);
            }
        });

        // B. Ejecutar todos los scripts
        try {
            const allIndicatorMarkers: any[] = [];
            pineIndicators.forEach(ind => {
                const results = executeVortexJS(ind.script, currentData, serverOffset, theme);
                const { lineSeries, markers, barColors, dashboard } = results;

                if (dashboard) combinedDashboard = { ...combinedDashboard, ...dashboard };
                if (markers) allIndicatorMarkers.push(...markers);
                if (barColors) {
                    barColors.forEach((bc: any) => finalBarColors.set(bc.time, bc.color));
                }

                // Sync line series (Atomic update)
                const existingSeries = pineSeriesRef.current[ind.id] || [];
                
                // Si el número de series ha cambiado, limpiamos y recreamos para seguridad
                if (existingSeries.length !== lineSeries.length) {
                    existingSeries.forEach(s => {
                        try { chartRef.current?.removeSeries(s); } catch (e) {}
                    });
                    
                    pineSeriesRef.current[ind.id] = lineSeries.map((ls: any) => {
                        let lineStyle = LineStyle.Solid;
                        if (ls.style === 'dashed') lineStyle = LineStyle.Dashed;
                        else if (ls.style === 'dotted') lineStyle = LineStyle.Dotted;
                        else if (ls.style === 'largeDashed') lineStyle = LineStyle.LargeDashed;
                        else if (ls.style === 'sparseDotted') lineStyle = LineStyle.SparseDotted;

                        const series = chartRef.current!.addLineSeries({
                            color: ls.color || '#2962ff',
                            lineWidth: (ls.linewidth as any) || 2,
                            lineStyle: lineStyle,
                            title: showPriceLabels ? ls.title : '',
                            lastValueVisible: showPriceLabels,
                        });
                        series.setData(ls.data);
                        return series;
                    });
                } else {
                    // Actualización normal (Optimizada Obrero Local)
                    lineSeries.forEach((ls: any, idx: number) => {
                        const series = existingSeries[idx];
                        if (series) {
                             if (isHistoryFetch || ls.data.length < 2) {
                                 series.setData(ls.data);
                             } else {
                                 const lastPoint = ls.data[ls.data.length - 1];
                                 if (lastPoint) series.update(lastPoint);
                             }
                        }
                    });
                }
            });
            indicatorMarkersRef.current = allIndicatorMarkers;
        } catch (error) {
            console.error('[Chart] Indicator execution crashed:', error);
        }

        // C. Aplicar colores y data a las velas (OPTIMIZADO OBRERO LOCAL)
        try {
            if (isHistoryFetch) {
                const coloredData = currentData.map(d => ({
                    ...d,
                    color: finalBarColors.get(d.time as number) || (d.close >= d.open ? '#757575' : '#000000')
                }));
                seriesRef.current.setData(coloredData as any);
            } else {
                const lastBar = currentData[currentData.length - 1];
                if (lastBar) {
                    const color = finalBarColors.get(lastBar.time as number) || (lastBar.close >= lastBar.open ? '#757575' : '#000000');
                    seriesRef.current.update({ ...lastBar, color } as any);
                }
            }
            
            // D. Marcadores y Dashboard
            if (typeof setDashboardData === 'function') {
                setDashboardData(combinedDashboard);
            }
            
            // 🛡️ REFRESH UNIFICADO
            if ((chartRef.current as any)?._refreshMarkers) {
                (chartRef.current as any)._refreshMarkers();
            }

        } catch (e) {
            console.warn('[Chart] Final render step recovered from:', e);
        }

    }, [pineIndicators, dataLength, serverOffset, showDetailedMarkers]);

    // 7. Anchored VWAP Engine (Reactive with Primitive API)
    useEffect(() => {
        if (!chartRef.current || !seriesRef.current || dataLength === 0) return;
        const series = seriesRef.current;

        // Clean up / Hide deleted AVWAPs (Persistent plugins to avoid LWC V5 lag bug)
        const currentIds = (currentAnchoredVwaps || []).map(v => v.id);
        Object.keys(drawingsRef.current).forEach(id => {
            if (id.startsWith('avwap_')) {
                const plugin = drawingsRef.current[id] as AnchoredVwapPrimitive;
                if (plugin && !currentIds.includes(id.replace('avwap_', ''))) {
                    plugin.visible = false;
                    if (plugin.requestUpdate) plugin.requestUpdate();
                }
            }
        });

        // Render/Update AVWAPs
        (currentAnchoredVwaps || []).forEach(v => {
            const pluginId = `avwap_${v.id}`;
            let plugin = drawingsRef.current[pluginId] as AnchoredVwapPrimitive;
            
            if (!plugin) {
                plugin = new AnchoredVwapPrimitive(v.startTime, dataRef.current, { color: v.color, width: v.lineWidth }, v.bands || []);
                series.attachPrimitive(plugin);
                drawingsRef.current[pluginId] = plugin;
            } else {
                plugin.visible = true;
                plugin.startTime = v.startTime;
                plugin.parameters = { color: v.color, width: v.lineWidth };
                plugin.bands = v.bands || [];
                plugin.data = dataRef.current; // Data setter handles internal update check and requestUpdate
            }
        });
    }, [currentAnchoredVwaps, dataLength]);

    // 6. Handle Time Range Scaling
    useEffect(() => {
        if (!chartRef.current || !chartRange || dataLength === 0) return;

        const timeScale = chartRef.current.timeScale();
        const lastBar = dataRef.current[dataRef.current.length - 1];
        const to = (lastBar.time as number);
        let from = to;

        const oneDay = 24 * 60 * 60;

        switch (chartRange) {
            case '1D': from = to - oneDay; break;
            case '5D': from = to - (5 * oneDay); break;
            case '1M': from = to - (30 * oneDay); break;
            case '3M': from = to - (90 * oneDay); break;
            case '6M': from = to - (180 * oneDay); break;
            case '1Y': from = to - (365 * oneDay); break;
            case 'YTD': 
                from = new Date(new Date().getFullYear(), 0, 1).getTime() / 1000;
                break;
            case 'Todo': 
                timeScale.fitContent();
                setChartRange(null);
                return;
        }

        try {
            timeScale.setVisibleRange({ from: from as Time, to: to as Time });
        } catch (e) {
            console.warn("Error setting range:", e);
        }
        
        setChartRange(null);
    }, [chartRange, dataLength, setChartRange]);

    return (
        <div className="flex flex-col h-full w-full bg-[#0a0e15] overflow-hidden">
            <div className="flex-1 flex min-h-0 relative">
                    <div className="flex-1 relative flex flex-col min-w-0 h-full overflow-hidden">
                        {/* PANEL SUPERIOR (PRECIO) */}
                        <div 
                            ref={chartContainerRef} 
                            className="w-full relative overflow-hidden" 
                            style={{ height: `${mainPaneHeight}%` }}
                        >
                            {/* OPTIMIZED OVERLAYS (Relative to Main Pane) */}
                            {isChartReady && chartRef.current && seriesRef.current && (
                                <>
                                    <HeatmapOverlay chart={chartRef.current} series={seriesRef.current} />
                                    <BigTradesOverlay chart={chartRef.current} series={seriesRef.current} />
                                    <OrderFlowStrategiesOverlay chart={chartRef.current} series={seriesRef.current} />
                                    <TradingOverlay chart={chartRef.current} series={seriesRef.current} />
                                    <SessionZonesOverlay
                                        chart={chartRef.current}
                                        subChart={subChartRef.current}
                                        series={seriesRef.current}
                                    />
                                    <DeltaLevelsOverlay
                                        chart={chartRef.current}
                                        series={seriesRef.current}
                                    />
                                </>
                            )}
                        </div>

                        {/* SEPARADOR AJUSTABLE (The Ribbon) */}
                        <div 
                            onMouseDown={() => setIsResizing(true)}
                            className={`h-1.5 w-full cursor-ns-resize z-50 border-y transition-colors select-none ${
                                theme === 'dark' 
                                    ? (isResizing ? 'bg-[#2962ff] border-blue-600' : 'bg-[#1e222d] border-gray-800/50 hover:bg-gray-700') 
                                    : (isResizing ? 'bg-blue-600 border-blue-700' : 'bg-gray-100 border-gray-200 hover:bg-gray-200')
                            }`}
                        >
                            <div className="w-12 h-1 bg-white/10 rounded-full mx-auto mt-[1px]" />
                        </div>

                        {/* PANEL INFERIOR (CVD / INDICADORES) */}
                        <div 
                            ref={subChartContainerRef} 
                            className="w-full relative overflow-hidden flex-1"
                        />

                        {/* Quick Trading Buttons */}
                        <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
                            <div className={`flex border rounded-[4px] overflow-hidden shadow-2xl items-center backdrop-blur-sm ${
                                theme === 'dark' ? 'bg-[#1e222d]/40 border-gray-700/30' : 'bg-white/40 border-gray-300/30'
                            }`}>
                                <button 
                                    onClick={() => {
                                        const params = {
                                            symbol: symbol,
                                            type: 'SELL',
                                            lot: defaultLot || 0.01,
                                            price: lastTickPrice || 0
                                        };
                                        useStore.getState().placeTradingOrder(params);
                                    }}
                                    className="bg-[#f23645] hover:bg-[#f23645]/90 text-white px-4 py-1 text-xs font-bold transition-colors flex flex-col items-center min-w-[70px] rounded-l-[4px]"
                                >
                                    <span>SELL</span>
                                    <span className="text-[9px] opacity-80">{lastTickPrice?.toFixed(2)}</span>
                                </button>
                                
                                <div className={`border-x h-full flex items-center px-1 ${
                                    theme === 'dark' ? 'bg-black/20 border-white/10' : 'bg-white/30 border-black/10'
                                }`}>
                                    <input 
                                        type="number" 
                                        step="0.01"
                                        min="0.01"
                                        value={defaultLot || 0.01}
                                        onChange={(e) => {
                                            const val = parseFloat(e.target.value);
                                            if (!isNaN(val) && val > 0) setDefaultLot(val);
                                            else if (e.target.value === "") setDefaultLot(0.01);
                                        }}
                                        className={`bg-transparent text-[11px] font-bold w-12 text-center outline-none ${
                                            theme === 'dark' ? 'text-white' : 'text-black'
                                        }`}
                                    />
                                </div>

                                <button 
                                    onClick={() => {
                                        const params = {
                                            symbol: symbol,
                                            type: 'BUY',
                                            lot: defaultLot || 0.01,
                                            price: lastTickPrice || 0
                                        };
                                        useStore.getState().placeTradingOrder(params);
                                    }}
                                    className="bg-[#089981] hover:bg-[#089981]/90 text-white px-4 py-1 text-xs font-bold transition-colors flex flex-col items-center min-w-[70px] rounded-r-[4px]"
                                >
                                    <span>BUY</span>
                                    <span className="text-[9px] opacity-80">{lastTickPrice?.toFixed(2)}</span>
                                </button>
                            </div>
                        </div>

                    </div>

                    {selectedAnchoredVwapId && (
                        <div className={`absolute bottom-20 left-4 z-20 border p-4 rounded-xl shadow-2xl backdrop-blur-lg w-72 transition-all animate-in fade-in slide-in-from-bottom-2 ${
                            theme === 'dark' ? 'bg-[#1e222d]/90 border-gray-700/50 text-white' : 'bg-white/90 border-gray-200 text-gray-900'
                        }`}>
                            <div className="flex justify-between items-center mb-4 border-b pb-2">
                                <h3 className="text-sm font-bold flex items-center gap-2">
                                    <span className="text-orange-500">⚓</span> Anchored VWAP
                                </h3>
                                <button onClick={() => setSelectedAnchoredVwapId(null)} className="text-xs opacity-50 hover:opacity-100 italic">Cerrar</button>
                            </div>

                            {currentAnchoredVwaps.find(v => v.id === selectedAnchoredVwapId) && (
                                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                    {/* Main Line Config */}
                                    <div className="space-y-2">
                                        <div className="text-[10px] uppercase tracking-wider opacity-60 font-bold">Línea Principal</div>
                                        <div className="flex items-center gap-3">
                                            <input 
                                                type="color" 
                                                value={currentAnchoredVwaps.find(v => v.id === selectedAnchoredVwapId)?.color || '#ff9800'} 
                                                onChange={(e) => updateAnchoredVwap(selectedAnchoredVwapId, { color: e.target.value })}
                                                className="w-8 h-8 rounded cursor-pointer bg-transparent border-none"
                                            />
                                            <select 
                                                value={currentAnchoredVwaps.find(v => v.id === selectedAnchoredVwapId)?.lineWidth || 2}
                                                onChange={(e) => updateAnchoredVwap(selectedAnchoredVwapId, { lineWidth: parseInt(e.target.value) })}
                                                className={`text-xs p-1 rounded bg-transparent border ${theme === 'dark' ? 'border-gray-700' : 'border-gray-200'}`}
                                            >
                                                {[1,2,3,4].map(w => <option key={w} value={w}>{w}px</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Bands Config */}
                                    <div className="space-y-3 pt-2">
                                        <div className="text-[10px] uppercase tracking-wider opacity-60 font-bold">Bandas Sigma ({"+/- 1, 2"})</div>
                                        {currentAnchoredVwaps.find(v => v.id === selectedAnchoredVwapId)?.bands.map((band: any, idx: number) => (
                                            <div key={idx} className="flex items-center justify-between gap-2 p-2 rounded bg-black/5">
                                                <div className="flex items-center gap-2">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={band.enabled} 
                                                        onChange={(e) => {
                                                            const currentVwap = currentAnchoredVwaps.find(v => v.id === selectedAnchoredVwapId);
                                                            if (!currentVwap) return;
                                                            const newBands = [...currentVwap.bands];
                                                            newBands[idx] = { ...band, enabled: e.target.checked };
                                                            updateAnchoredVwap(selectedAnchoredVwapId, { bands: newBands });
                                                        }}
                                                    />
                                                    <span className="text-xs font-mono">{band.multiplier > 0 ? `+${band.multiplier}` : band.multiplier}σ</span>
                                                </div>
                                                <input 
                                                    type="color" 
                                                    value={band.color} 
                                                    onChange={(e) => {
                                                        const currentVwap = currentAnchoredVwaps.find(v => v.id === selectedAnchoredVwapId);
                                                        if (!currentVwap) return;
                                                        const newBands = [...currentVwap.bands];
                                                        newBands[idx] = { ...band, color: e.target.value };
                                                        updateAnchoredVwap(selectedAnchoredVwapId, { bands: newBands });
                                                    }}
                                                    className="w-5 h-5 rounded cursor-pointer"
                                                />
                                            </div>
                                        ))}
                                    </div>

                                    <button 
                                        onClick={() => removeAnchoredVwap(selectedAnchoredVwapId)}
                                        className="w-full mt-4 p-2 text-xs bg-red-500/10 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-colors border border-red-500/20"
                                    >
                                        Eliminar Herramienta (Supr)
                                    </button>
                                </div>
                            )}
                        </div>
                    )}

                    {/* Dashboard Overlay */}
                    {dashboardData && Object.keys(dashboardData).length > 0 && (
                        <div className={`absolute top-4 right-[110px] z-10 border p-3 rounded-lg shadow-xl backdrop-blur-md min-w-[200px] pointer-events-none transition-all ${
                            theme === 'dark'
                                ? 'bg-[#1e222d]/90 border-gray-700/50'
                                : 'bg-white/90 border-gray-200'
                        }`}>
                            <div className={`text-[10px] font-bold mb-2 tracking-widest uppercase border-b pb-1 ${
                                theme === 'dark' ? 'text-blue-400 border-gray-700/50' : 'text-blue-600 border-gray-200'
                            }`}>Trade Checklist</div>
                            <div className="space-y-1.5">
                                {Object.entries(dashboardData).map(([key, value]) => (
                                    <div key={key} className="flex justify-between items-center gap-4">
                                        <span className={`text-[11px] ${theme === 'dark' ? 'text-gray-400' : 'text-gray-600'}`}>{key}</span>
                                        <span className={`text-[11px] font-medium ${
                                            (value as string).includes('ALCISTA') || (value as string).includes('BALANCE') || (value as string).includes('COMPRA') ? 'text-green-400' :
                                            (value as string).includes('BAJISTA') || (value as string).includes('DISCOVERY') || (value as string).includes('VENTA') ? 'text-red-400' :
                                            theme === 'dark' ? 'text-white' : 'text-gray-900'
                                        }`}>{value as string}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <DrawingToolbar />
                </div>
            </div>
    );
};

export default ChartComponent;

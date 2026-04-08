import React, { useEffect, useRef } from 'react';
import { IChartApi, ISeriesApi } from 'lightweight-charts';
import { useStore } from '../../store/useStore';

interface HeatmapOverlayProps {
    chart: IChartApi;
    series: ISeriesApi<"Candlestick">;
}

/** Intensidad 0-1 → escala DeepDOM: Cian (baja) → Naranja (media) → Rojo Vivo (alta) */
function heatColor(intensity: number): string {
    const i = Math.max(0, Math.min(1, intensity));
    let r: number, g: number, b: number, a: number;

    if (i < 0.3) {
        // Cian / Azul verdoso suave (Capa base)
        const t = i / 0.3;
        r = 0; g = Math.round(180 + t * 40); b = Math.round(200 + t * 55);
        a = 0.12 + t * 0.18;
    } else if (i < 0.7) {
        // Naranja brillante (Liquidez relevante)
        const t = (i - 0.3) / 0.4;
        r = Math.round(t * 255); g = Math.round(220 - t * 40); b = Math.round(255 - t * 255);
        a = 0.35 + t * 0.40;
    } else {
        // Rojo Vivo / Blanco-Naranja (Muros extremos)
        const t = (i - 0.7) / 0.3;
        r = 255; g = Math.round(180 - t * 180); b = 0;
        a = 0.75 + t * 0.25;
    }
    return `rgba(${r},${g},${b},${a})`;
}

export const HeatmapOverlay: React.FC<HeatmapOverlayProps> = ({ chart, series }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const dirtyRef  = useRef<boolean>(true);

    const renderRef = useRef<() => void>(() => {});
    const workerRef = useRef<Worker | null>(null);
    const isTransferredRef = useRef(false);

    const lastTimestampRef = useRef<number>(0);

    // ─── Inicialización y Sincronización del Worker (Estrategia Pugobot) ──────
    useEffect(() => {
        // 1. Asegurar la existencia del Worker
        if (!workerRef.current) {
            workerRef.current = new Worker(new URL('../../workers/HeatmapWorker.ts', import.meta.url), { type: 'module' });
        }
        const worker = workerRef.current;

        // 2. Transferir el control del canvas (Solo una vez)
        const canvas = canvasRef.current;
        if (canvas && !isTransferredRef.current) {
            try {
                const offscreen = canvas.transferControlToOffscreen();
                worker.postMessage({ type: 'INIT', payload: { canvas: offscreen } }, [offscreen]);
                isTransferredRef.current = true;
            } catch (e) {
                console.warn("[Pugobot] Error transfer:", e);
            }
        }

        // 3. Carga inicial del historial
        const initialState = useStore.getState();
        worker.postMessage({
            type: 'SET_HISTORY',
            payload: {
                heatmap: initialState.heatmapData,
                trades: initialState.bigTradesData
            }
        });

        // 4. Suscripción a actualizaciones Incrementales (Deltas)
        const unsub = useStore.subscribe((state, prev) => {
            const currentWorker = workerRef.current;
            if (!currentWorker) return;

            // Enviar solo el snapshot más reciente si el tiempo ha cambiado
            const timestamps = Object.keys(state.heatmapData);
            if (timestamps.length === 0) return;
            
            // Usar Math.max para evitar sorting pesado
            const latestT = Math.max(...timestamps.map(Number));
            
            if (latestT && latestT > lastTimestampRef.current) {
                lastTimestampRef.current = latestT;
                currentWorker.postMessage({
                    type: 'APPEND_SNAPSHOT',
                    payload: {
                        time: latestT,
                        data: state.heatmapData[latestT],
                        lastPrice: state.lastTickPrice || 0
                    }
                });
            }

            // Trades: Solo si han cambiado (Referencia de objeto)
            if (state.bigTradesData !== prev.bigTradesData) {
                currentWorker.postMessage({
                    type: 'UPDATE_TRADES',
                    payload: { trades: state.bigTradesData }
                });
            }
        });

        return () => {
            unsub();
            // NO terminamos el worker aquí para permitir persistencia en re-renders rápidos
            // de React, el isTransferredRef protege la integridad del OffscreenCanvas.
        };
    }, []); 



    renderRef.current = () => {
        const worker = workerRef.current;
        if (!worker) return;

        const state = useStore.getState();
        if (!state.orderFlowStrategies.bookmap) {
            // Limpiar si está desactivado
            worker.postMessage({ type: 'RENDER', payload: { width: 0, height: 0 } });
            return;
        }

        const timeScale = chart.timeScale();
        const visibleRange = timeScale.getVisibleRange();
        if (!visibleRange) return;

        const priceAtTop    = series.coordinateToPrice(0);
        const priceAtBottom = series.coordinateToPrice(canvasRef.current?.height || 0);
        if (priceAtTop === null || priceAtBottom === null) return;

        const timestamps = Object.keys(state.heatmapData).map(Number).sort((a,b)=>a-b);
        const lastSnapshotT = timestamps[timestamps.length - 1];
        const lastBarTime = state.data.length > 0 ? (state.data[state.data.length - 1].time as number) : Math.floor(Date.now()/1000);
        const timeOffset = (lastSnapshotT && Math.abs(lastBarTime - lastSnapshotT) > 300) ? lastBarTime - lastSnapshotT : 0;

        const x1 = timeScale.timeToCoordinate(visibleRange.from);
        const x2 = timeScale.timeToCoordinate(visibleRange.to);
        const t1 = Number(visibleRange.from);
        const t2 = Number(visibleRange.to);
        const pps = (x1 !== null && x2 !== null && t2 > t1) ? (x2 - x1) / (t2 - t1) : 0;

        // Delegar RENDER al worker
        worker.postMessage({
            type: 'RENDER',
            payload: {
                width: canvasRef.current?.width || 0,
                height: canvasRef.current?.height || 0,
                minP: Math.min(priceAtTop, priceAtBottom),
                maxP: Math.max(priceAtTop, priceAtBottom),
                t1_vis: t1,
                t2_vis: t2,
                timeOffset,
                pixelsPerSecond: pps
            }
        });
    };

    // ─── Tamaño del canvas ──────────────────────────────────────────────────────
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        canvas.dataset.heatmap = 'true';
        const container = canvas.parentElement;
        if (!container) return;

        const getLwCanvas = (): HTMLCanvasElement | null =>
            container.querySelector('canvas:not([data-heatmap])');

        const applySize = () => {
            const lwc = getLwCanvas();
            if (!lwc) return;

            const rect  = lwc.getBoundingClientRect();
            const pRect = container.getBoundingClientRect();
            canvas.style.left   = '0px';
            canvas.style.top    = '0px';
            
            const w = lwc.clientWidth;
            const h = lwc.clientHeight;

            // CRÍTICO: Si el canvas ya ha sido transferido, NO podemos tocar .width/.height
            if (isTransferredRef.current && workerRef.current) {
                workerRef.current.postMessage({ type: 'RESIZE', payload: { width: w, height: h } });
            } else {
                canvas.width  = w;
                canvas.height = h;
            }
            dirtyRef.current = true;
        };

        applySize();

        const ro = new ResizeObserver(applySize);
        ro.observe(container);
        window.addEventListener('resize', applySize);
        return () => { ro.disconnect(); window.removeEventListener('resize', applySize); };
    }, [chart, series]);


    // ─── Loop RAF sin lag ───────────────────────────────────────────────────────
    // Compara el rango lógico (X) y el mapeo de coordenadas (Y) cada frame
    // para sincronizarse exactamente con el paint de lightweight-charts.
    useEffect(() => {
        let rafId: number;
        let lastXRange = '';
        let lastYCoordinate = 0;

        const loop = () => {
            const timeScale = chart.timeScale();
            const logicalRange = timeScale.getVisibleLogicalRange();
            const rangeStr = logicalRange ? `${logicalRange.from}-${logicalRange.to}` : '';
            const yCoord = series.priceToCoordinate(series.coordinateToPrice(0) || 0) || 0;
            const enabled = useStore.getState().orderFlowStrategies.bookmap;

            if (rangeStr !== lastXRange || yCoord !== lastYCoordinate || dirtyRef.current || !enabled) {
                lastXRange = rangeStr;
                lastYCoordinate = yCoord;
                dirtyRef.current = false;
                renderRef.current();
            }
            rafId = requestAnimationFrame(loop);
        };

        rafId = requestAnimationFrame(loop);
        return () => cancelAnimationFrame(rafId);
    }, [chart, series]);

    // ─── Store subscription ─────────────────────────────────────────────────────
    // Marca dirty cuando llegan nuevos datos o cambia el toggle.
    // El RAF loop se encargará de dibujar en el próximo frame.
    useEffect(() => {
        const unsubStore = useStore.subscribe((state, prev) => {
            if (
                state.heatmapData !== prev.heatmapData ||
                state.orderFlowStrategies.bookmap !== prev.orderFlowStrategies.bookmap
            ) {
                dirtyRef.current = true;
            }
        });
        return () => unsubStore();
    }, []);

    return (
        <canvas
            ref={canvasRef}
            style={{
                position: 'absolute',
                top: 0,
                left: 0,
                pointerEvents: 'none',
                zIndex: 10,
                mixBlendMode: 'screen',
            }}
        />
    );
};

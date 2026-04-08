/**
 * HeatmapWorker.ts
 * Motor de renderizado ultra-rápido fuera del hilo principal.
 * Utiliza OffscreenCanvas para dibujo directo y zero-lag.
 */

interface HeatmapRow {
    p: number;
    s: number;
}

interface BigTrade {
    time: number;
    price: number;
    size: number;
    side: 'buy' | 'sell';
}

interface WorkerState {
    canvas: OffscreenCanvas | null;
    ctx: OffscreenCanvasRenderingContext2D | null;
    heatmapData: Record<number, HeatmapRow[]>;
    bigTrades: BigTrade[];
    lastTickPrice: number;
    colorCache: Record<string, string>;
    timestamps: number[];
}

const state: WorkerState = {
    canvas: null,
    ctx: null,
    heatmapData: {},
    bigTrades: [],
    lastTickPrice: 0,
    colorCache: {},
    timestamps: []
};

function heatColorDeepDOM(intensity: number): string {
    if (intensity < 0.15) return 'transparent'; // Descartado en render_heatmap, pero fallback seguro
    if (intensity < 0.30) return '#004d40';     // Teal Oscuro
    if (intensity < 0.45) return '#7e57c2';     // Morado (Purple)
    if (intensity < 0.60) return '#00e676';     // Verde Brillante
    if (intensity < 0.75) return '#ffeb3b';     // Amarillo
    if (intensity < 0.90) return '#ff9800';     // Naranja
    return '#ff1744';                           // Rojo Vibrante
}

self.onmessage = (evt: MessageEvent) => {
    const { type, payload } = evt.data;

    switch (type) {
        case 'INIT':
            state.canvas = payload.canvas;
            state.ctx = state.canvas!.getContext('2d');
            break;

        case 'SET_HISTORY':
            state.heatmapData = {};
            if (payload.heatmap) {
                Object.entries(payload.heatmap).forEach(([t, rows]) => {
                    state.heatmapData[Number(t)] = rows as HeatmapRow[];
                });
            }
            state.timestamps = Object.keys(state.heatmapData).map(Number).sort((a, b) => a - b);
            if (payload.trades) state.bigTrades = payload.trades;
            break;

        case 'APPEND_SNAPSHOT':
            if (payload.time && payload.data) {
                const t = Number(payload.time);
                // Si el tiempo es menor que el último, o es nuevo, gestionar timestamps
                if (!state.heatmapData[t]) {
                    state.heatmapData[t] = payload.data;
                    state.timestamps.push(t);
                    // Solo ordenar si el nuevo tiempo no es el mayor (usualmente lo es)
                    if (state.timestamps.length > 1 && t < state.timestamps[state.timestamps.length - 2]) {
                        state.timestamps.sort((a, b) => a - b);
                    }
                } else {
                    state.heatmapData[t] = payload.data;
                }
            }
            if (payload.lastPrice) state.lastTickPrice = payload.lastPrice;
            break;

        case 'UPDATE_TRADES':
            if (payload.trades) state.bigTrades = payload.trades;
            break;

        case 'RENDER':
            render_heatmap_deepdom(payload);
            break;

            
        case 'RESIZE':
            if (state.canvas) {
                state.canvas.width = payload.width;
                state.canvas.height = payload.height;
            }
            break;
    }
};

function render_heatmap_deepdom(p: any) {
    const { ctx } = state;
    if (!ctx || !state.canvas) return;

    const { width, height, minP, maxP, t1_vis, t2_vis, timeOffset, pixelsPerSecond } = p;
    const pad = (maxP - minP) * 0.05;

    ctx.clearRect(0, 0, width, height);

    // 1. Filtrar Timestamps Relevantes
    const margin = (t2_vis - t1_vis) * 0.1;
    const relevantIndices: number[] = [];
    for (let i = 0; i < state.timestamps.length; i++) {
        const t = state.timestamps[i] + timeOffset;
        if (t >= t1_vis - margin && t <= t2_vis + margin) relevantIndices.push(i);
    }
    if (relevantIndices.length === 0) return;

    // 2. Mapeo Y e Intensidad Max
    const yMap: Record<number, number> = {};
    let maxVol = 1;

    relevantIndices.forEach(idx => {
        const snapshot = state.heatmapData[state.timestamps[idx]];
        snapshot.forEach(row => {
            if (row.p >= minP - pad && row.p <= maxP + pad) {
                if (yMap[row.p] === undefined) {
                    yMap[row.p] = (height * (1 - (row.p - minP) / (maxP - minP))) + 0.5;
                }
                if (row.s > maxVol) maxVol = row.s;
            }
        });
    });

    const timeToX = (t: number) => (t - t1_vis) * pixelsPerSecond;

    // 3. Batching Vortex + RLE (Run-Length Encoding) "DeepDOM"
    const finalBatches: Record<string, {x: number, y: number, w: number, h: number}[]> = {};
    
    // activeRuns trackea por PRECIO un segmento contiguo horizontal
    const activeRuns = new Map<number, { startX: number, color: string, endX: number }>();
    const noiseThreshold = maxVol * 0.15; // Descartar el 15% inferior (filtro brutal)

    for (let i = 0; i < relevantIndices.length; i++) {
        const idx = relevantIndices[i];
        const t = state.timestamps[idx];
        const xStart = timeToX(t + timeOffset);
        
        const nextT = (i < relevantIndices.length - 1) ? state.timestamps[relevantIndices[i+1]] : (Date.now()/1000);
        const xEnd = timeToX(nextT + timeOffset);
        
        const currentPrices = new Set<number>();

        state.heatmapData[t].forEach(row => {
            if (row.s < noiseThreshold) return; 

            const y = yMap[row.p];
            if (y === undefined) return;
            
            const color = heatColorDeepDOM(row.s / maxVol);
            currentPrices.add(row.p);

            const active = activeRuns.get(row.p);
            if (active) {
                if (active.color === color) {
                    // MANTENER el muro: simplemente extendemos el Run hasta el próximo X
                    active.endX = xEnd;
                } else {
                    // CAMBIO de intensidad: cortar el puente viejo y empezar uno nuevo
                    if (!finalBatches[active.color]) finalBatches[active.color] = [];
                    // Asegurar un ancho mínimo visible
                    const w = Math.max(0.7, active.endX - active.startX);
                    finalBatches[active.color].push({ x: active.startX, y: y - 1, w: w, h: 2.2 });
                    
                    activeRuns.set(row.p, { startX: active.endX, color: color, endX: xEnd });
                }
            } else {
                // NUEVO muro en este nivel
                activeRuns.set(row.p, { startX: xStart, color: color, endX: xEnd });
            }
        });

        // 3.B. Cortar los Runs (Bloques) que estaban activos pero desaparecieron en este frame
        // (Liquidez consumida o retirada)
        for (const [p, active] of activeRuns.entries()) {
            if (!currentPrices.has(p)) {
                if (!finalBatches[active.color]) finalBatches[active.color] = [];
                const w = Math.max(0.7, active.endX - active.startX);
                finalBatches[active.color].push({ x: active.startX, y: yMap[p] - 1, w: w, h: 2.2 });
                activeRuns.delete(p);
            }
        }
    }

    // 3.C. Volcamos los muros que quedaron hasta el final de la pantalla
    for (const [p, active] of activeRuns.entries()) {
        if (!finalBatches[active.color]) finalBatches[active.color] = [];
        const w = Math.max(0.7, active.endX - active.startX);
        finalBatches[active.color].push({ x: active.startX, y: yMap[p] - 1, w: w, h: 2.2 });
    }

    // Dibujo en Base al RLE consolidado (Pintura Ultra-Optimizada)
    Object.keys(finalBatches).forEach(color => {
        if (color === 'transparent') return;
        ctx.fillStyle = color;
        const rects = finalBatches[color];
        for (let i = 0; i < rects.length; i++) {
            const r = rects[i];
            ctx.fillRect(r.x, r.y, r.w, r.h);
        }
    });

    // 4. Burbujas
    state.bigTrades.forEach(trade => {
        if (trade.size < 5) return;
        const tAdj = trade.time + timeOffset;
        if (tAdj < t1_vis || tAdj > t2_vis) return;
        const x = timeToX(tAdj);
        const y = height * (1 - (trade.price - minP) / (maxP - minP));

        const bSize = Math.max(3, Math.sqrt(trade.size) * 2.5);
        ctx.beginPath();
        ctx.arc(x, y, bSize, 0, Math.PI * 2);
        ctx.fillStyle = trade.side === 'buy' ? 'rgba(0, 255, 255, 0.4)' : 'rgba(255, 0, 255, 0.4)';
        ctx.fill();
    });

    // 5. DOM Panel Institucional (Estilo DeepDOM) - Solo Volúmenes
    const domPanelWidth = 60; // Reducido ya que el eje derecho ya tiene los precios
    const pX = width - domPanelWidth;
    
    // Fondo de panel
    ctx.fillStyle = 'rgba(12, 12, 12, 0.8)';
    ctx.fillRect(pX, 0, domPanelWidth, height);

    const lastSnap = state.heatmapData[state.timestamps[state.timestamps.length-1]];
    if (lastSnap) {
        ctx.font = 'bold 11px sans-serif';
        ctx.textBaseline = 'middle';

        lastSnap.forEach(row => {
            const y = yMap[row.p];
            if (y === undefined) return;
            
            const isAsk = row.p > state.lastTickPrice; // Lógica Asks vs Bids por encima/debajo del Last
            
            // 5a. DVP (Depth Volume Profile - Histograma)
            const bWidth = (row.s / maxVol) * 45; // ancho max 45px
            ctx.fillStyle = isAsk ? 'rgba(126, 87, 194, 0.4)' : 'rgba(2, 119, 189, 0.4)';
            ctx.fillRect(width - bWidth, y - 6, bWidth, 12);
            
            // 5b. Columna numérica (Solo Size)
            ctx.textAlign = 'right';
            if (isAsk) {
                ctx.fillStyle = 'rgba(126, 87, 194, 0.2)';
                ctx.fillRect(pX, y - 7, domPanelWidth, 14);
                // Texto Cantidad DVP a la derecha del todo
                ctx.fillStyle = '#ffb74d'; // Naranja tenso Asks
                ctx.fillText(row.s.toString(), width - 6, y);
            } else {
                ctx.fillStyle = 'rgba(2, 119, 189, 0.2)';
                ctx.fillRect(pX, y - 7, domPanelWidth, 14);
                // Texto Cantidad DVP a la derecha del todo
                ctx.fillStyle = '#69f0ae'; // Verde Bids
                ctx.fillText(row.s.toString(), width - 6, y);
            }
        });

        // 5c. Indicador del Precio Actual (Last Traded LT)
        const yLast = yMap[state.lastTickPrice];
        if (yLast !== undefined) {
            ctx.strokeStyle = 'rgba(255,255,255,0.6)';
            ctx.setLineDash([2, 4]);
            ctx.beginPath();
            ctx.moveTo(pX, yLast);
            ctx.lineTo(width, yLast);
            ctx.stroke();
            ctx.setLineDash([]);
        }
    }
}

import { OrderFlowAnalyzer, OrderFlowSetup, AbsorptionZone } from '../engine/orderflow/OrderFlowAnalyzer';

interface HeatmapRow {
    p: number;
    s: number;
}

interface VolumeProfile {
    bins: { [price: string]: number };
    totalVolume: number;
    vah: number;
    val: number;
    poc: number;
}

interface WorkerState {
    canvas: OffscreenCanvas | null;
    ctx: OffscreenCanvasRenderingContext2D | null;
    heatmapData: { [time: number]: HeatmapRow[] };
    timestamps: number[];
    bigTrades: any[];
    lastTickPrice: number;
    profiles: {
        overnight: VolumeProfile;
        london: VolumeProfile;
        ny: VolumeProfile;
    };
    analyzer: OrderFlowAnalyzer;
    activeSetups: OrderFlowSetup[];
}

const createEmptyProfile = (): VolumeProfile => ({
    bins: {},
    totalVolume: 0,
    vah: 0,
    val: 0,
    poc: 0
});

const state: WorkerState = {
    canvas: null,
    ctx: null,
    heatmapData: {},
    timestamps: [],
    bigTrades: [],
    lastTickPrice: 0,
    profiles: {
        overnight: createEmptyProfile(),
        london: createEmptyProfile(),
        ny: createEmptyProfile()
    },
    analyzer: new OrderFlowAnalyzer(),
    activeSetups: []
};

/**
 * LÓGICA DE SEGMENTACIÓN HORARIA (NY TIME)
 */
function getSessionType(timestamp: number): 'overnight' | 'london' | 'ny' | null {
    const date = new Date(timestamp * 1000);
    // Convertir a hora de Nueva York (EST/EDT)
    const nyTime = date.toLocaleTimeString('en-US', { hour12: false, timeZone: 'America/New_York' });
    const [hh, mm] = nyTime.split(':').map(Number);
    const timeVal = hh * 100 + mm;

    if (timeVal >= 1800 || timeVal < 300) return 'overnight';
    if (timeVal >= 300 && timeVal < 930) return 'london';
    if (timeVal >= 930 && timeVal < 1700) return 'ny';
    return null;
}

function updateProfile(profile: VolumeProfile, rows: HeatmapRow[]) {
    const step = 0.25; // Precisión de 1 tick (NQ/ES)
    for (const row of rows) {
        const pBin = (Math.round(row.p / step) * step).toFixed(2);
        profile.bins[pBin] = (profile.bins[pBin] || 0) + row.s;
        profile.totalVolume += row.s;
    }

    // Calcular POC, VAH, VAL (70% Value Area)
    const bins = Object.entries(profile.bins).map(([p, v]) => ({ p: parseFloat(p), v: v }));
    if (bins.length === 0) return;

    let maxV = 0;
    let poc = 0;
    for (const b of bins) {
        if (b.v > maxV) {
            maxV = b.v;
            poc = b.p;
        }
    }
    profile.poc = poc;

    // Value Area (70%)
    bins.sort((a, b) => b.v - a.v);
    let currentVol = 0;
    const targetVol = profile.totalVolume * 0.7;
    let minP = Infinity, maxP = -Infinity;
    
    for (const b of bins) {
        currentVol += b.v;
        if (b.p < minP) minP = b.p;
        if (b.p > maxP) maxP = b.p;
        if (currentVol >= targetVol) break;
    }
    profile.vah = maxP;
    profile.val = minP;
}

function getLaserColor(intensity: number, alpha: number): string {
    const a = Math.min(alpha, 0.9);
    if (intensity > 0.8) return `rgba(0, 255, 255, ${a})`; 
    if (intensity > 0.5) return `rgba(0, 150, 255, ${a * 0.8})`; 
    return `rgba(50, 70, 100, ${a * 0.4})`;
}

function findStartIndex(arr: number[], target: number): number {
    let low = 0;
    let high = arr.length - 1;
    while (low <= high) {
        let mid = (low + high) >>> 1;
        if (arr[mid] < target) low = mid + 1;
        else if (arr[mid] > target) high = mid - 1;
        else return mid;
    }
    return Math.max(0, low - 1);
}

self.onmessage = (evt: MessageEvent) => {
    const { type, payload } = evt.data;
    switch (type) {
        case 'INIT':
            state.canvas = payload.canvas;
            state.ctx = state.canvas!.getContext('2d', { alpha: true, desynchronized: true });
            break;
        case 'SET_HISTORY':
            state.heatmapData = {};
            state.profiles.overnight = createEmptyProfile();
            state.profiles.london = createEmptyProfile();
            state.profiles.ny = createEmptyProfile();
            
            if (payload.heatmap) {
                Object.entries(payload.heatmap).forEach(([t, rows]) => {
                    const time = Number(t);
                    state.heatmapData[time] = rows as HeatmapRow[];
                    const sess = getSessionType(time);
                    if (sess) updateProfile(state.profiles[sess], rows as HeatmapRow[]);
                });
            }
            state.timestamps = Object.keys(state.heatmapData).map(Number).sort((a, b) => a - b);
            if (payload.trades) state.bigTrades = payload.trades;
            break;
        case 'APPEND_SNAPSHOT':
            if (payload.time && payload.data) {
                const t = Number(payload.time);
                state.heatmapData[t] = payload.data;
                state.timestamps.push(t);
                const sess = getSessionType(t);
                if (sess) updateProfile(state.profiles[sess], payload.data);
            }
            if (payload.lastPrice) state.lastTickPrice = payload.lastPrice;
            break;
        case 'UPDATE_TRADES':
            if (payload.trades) state.bigTrades = payload.trades;
            break;
        case 'RENDER':
            render_full_bunker(payload);
            break;
        case 'RESIZE':
            if (state.canvas) {
                state.canvas.width = payload.width;
                state.canvas.height = payload.height;
            }
            break;
    }
};

/**
 * MOTOR BÚNKER 6.1: MULTI-SESSION RADAR
 */
function render_full_bunker(p: any) {
    const { ctx } = state;
    if (!ctx || !state.canvas) return;

    const { width, height, minP, maxP, t1_vis, t2_vis, timeOffset, pixelsPerSecond, vwap, val, vah } = p;
    if (width === 0 || height === 0) return;

    // --- 0. ANÁLISIS DE ORDER FLOW (NUEVA INTELIGENCIA) ---
    const currentAbsorptions = state.analyzer.analyzeBigTrades(state.bigTrades, state.lastTickPrice);
    const setup = state.analyzer.detectSetups(state.lastTickPrice, vwap || 0, val || 0, vah || 0);
    if (setup) {
        // Podríamos enviar el setup de vuelta al main thread para alertas sonoras
        self.postMessage({ type: 'SETUP_DETECTED', payload: setup });
    }

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#0a0a0b';
    ctx.fillRect(0, 0, width, height);

    const timeToX = (t: number) => (t - t1_vis) * pixelsPerSecond;

    // --- 1. DIBUJO DE PERFILES DE SESIÓN (LOS CIMIENTOS CON ANCLAJE A VELA) ---
    const sessionsOrder: ('overnight' | 'london' | 'ny')[] = ['overnight', 'london', 'ny'];
    
    // Tiempos de inicio exactos para el anclaje visual a la vela (Horario NY)
    const getStartTime = (s: string) => {
        if (s === 'overnight') return 1800; // 18:00
        if (s === 'london') return 300;    // 03:00
        return 930;                        // 09:30
    }

    for (const sName of sessionsOrder) {
        const prof = state.profiles[sName];
        if (prof.totalVolume === 0) continue;

        // Buscar el primer snapshot de esta sesión para anclar el dibujo a su vela
        let sessionStartX = 0;
        for (let i = 0; i < state.timestamps.length; i++) {
            const sess = getSessionType(state.timestamps[i]);
            if (sess === sName) {
                sessionStartX = timeToX(state.timestamps[i] + timeOffset);
                break;
            }
        }

        const bins = Object.entries(prof.bins);
        let maxV = 0;
        for (const [_, v] of bins) if (v > maxV) maxV = v;

        /* ctx.save();
        // INTENSIDAD AUMENTADA: 25% de opacidad para claridad superior
        ctx.globalAlpha = 0.25; 
        for (const [pStr, v] of bins) {
            const price = parseFloat(pStr);
            if (price < minP || price > maxP) continue;
            const y = (height * (1 - (price - minP) / (maxP - minP)));
            const barW = (v / maxV) * (width * 0.18); 
            
            // Histograma anclado a la vela de inicio
            ctx.fillStyle = '#787b86';
            ctx.fillRect(sessionStartX, y - 1, barW, 2);
        }
        ctx.restore(); */

        // Líneas de Valor (Láseres técnicos reforzados)
        /* if (prof.poc > 0) {
            const yPoc = (height * (1 - (prof.poc - minP) / (maxP - minP)));
            ctx.save();
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(242, 54, 69, 0.8)'; // POC Rojo más intenso
            ctx.lineWidth = 1.5;
            ctx.setLineDash([8, 4]);
            ctx.moveTo(sessionStartX, yPoc); 
            ctx.lineTo(width, yPoc);
            ctx.stroke();

            const yVah = (height * (1 - (prof.vah - minP) / (maxP - minP)));
            const yVal = (height * (1 - (prof.val - minP) / (maxP - minP)));
            ctx.setLineDash([4, 6]);
            ctx.strokeStyle = 'rgba(160, 160, 170, 0.6)'; // VAH/VAL más visibles
            ctx.beginPath(); ctx.moveTo(sessionStartX, yVah); ctx.lineTo(width, yVah); ctx.stroke();
            ctx.beginPath(); ctx.moveTo(sessionStartX, yVal); ctx.lineTo(width, yVal); ctx.stroke();
            ctx.restore();
        } */
    }

    // --- 2. LÁSERES DE REJECTION (EL RADAR ACTUAL) ---
    const filterThresh = p.heatmapFilter !== undefined ? p.heatmapFilter : 50;
    const lastT = state.timestamps[state.timestamps.length - 1];
    if (lastT) {
        const snap = state.heatmapData[lastT];
        const xNow = timeToX(lastT + timeOffset);
        let localMax = 1;
        for (const r of snap) if (r.s > localMax) localMax = r.s;

        ctx.save();
        for (const row of snap) {
            if (row.s < filterThresh) continue;
            const y = (height * (1 - (row.p - minP) / (maxP - minP)));
            const intensity = (row.s - filterThresh) / (localMax - filterThresh + 1);
            const color = getLaserColor(intensity, 0.8);
            
            const grad = ctx.createLinearGradient(0, y, xNow, y);
            grad.addColorStop(0, 'rgba(0, 0, 0, 0)');
            grad.addColorStop(1, color);
            
            ctx.fillStyle = grad;
            ctx.fillRect(0, y - 0.75, width, 1.5);
            ctx.fillStyle = color;
            ctx.fillRect(xNow, y - 1, width - xNow, 2);
        }
        ctx.restore();
    }

    // --- 3. BIG TRADES (ANCLAJE 6.3 - REPARADO MILIMÉTRICAMENTE) ---
    if (p.showBigTrades) {
        const bTrades = p.bigTrades || [];
        const minTSize = Number(p.minTradeSize || 20);
        ctx.save();
        for (const trade of bTrades) {
            // SOLDADURA ATÓMICA (v6.4): Usamos la coordenada X real inyectada
            const x = trade.x;
            const priceY = (height * (1 - (trade.price - minP) / (maxP - minP)));
            
            // ESCALADO DRÁSTICO (Persistente)
            const bSize = Math.max(3, Math.pow(trade.size, 0.65) * 1.2);
            
            ctx.beginPath();
            ctx.arc(x, priceY, bSize, 0, 6.28);
            
            const intensity = Math.min(1, trade.size / 200);
            const alpha = 0.5 + (intensity * 0.3);
            const color = trade.side === 'buy' ? `rgba(0, 255, 255, ${alpha})` : `rgba(255, 100, 255, ${alpha})`;
            ctx.fillStyle = color;

            if (trade.size > 100) { 
                ctx.shadowBlur = 20; 
                ctx.shadowColor = trade.side === 'buy' ? 'cyan' : 'magenta'; 
            } else {
                ctx.shadowBlur = 0;
            }
            
            ctx.fill();

            // Bordes definidos para visibilidad en movimiento
            if (trade.size > 50) { 
                ctx.strokeStyle = "rgba(255, 255, 255, 0.7)"; 
                ctx.lineWidth = 1; 
                ctx.stroke(); 
            }
        }
        ctx.restore();
    }

    // --- 4. VISUALIZACIÓN DE ABSORCIONES (ZONAS DE DOLOR) ---
    ctx.save();
    for (const zone of currentAbsorptions) {
        const y = (height * (1 - (zone.price - minP) / (maxP - minP)));
        const color = zone.side === 'buy' ? 'rgba(255, 0, 0, 0.3)' : 'rgba(0, 255, 0, 0.3)';
        ctx.fillStyle = color;
        ctx.fillRect(0, y - 5, width, 10);
        
        ctx.strokeStyle = zone.side === 'buy' ? '#ff0000' : '#00ff00';
        ctx.setLineDash([2, 4]);
        ctx.strokeRect(0, y - 5, width, 10);
        
        ctx.fillStyle = 'white';
        ctx.font = '8px monospace';
        ctx.fillText(`TRAPPED ${zone.side.toUpperCase()}`, 10, y + 3);
    }
    ctx.restore();

    // --- 5. SEÑALES DE SETUP (DIAMANTES ADRIANUS) ---
    if (setup) {
        const x = timeToX((Date.now() / 1000) + timeOffset);
        const y = (height * (1 - (setup.price - minP) / (maxP - minP)));
        
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(Math.PI / 4);
        ctx.fillStyle = setup.side === 'long' ? '#00ff00' : '#ff0000';
        ctx.shadowBlur = 15;
        ctx.shadowColor = ctx.fillStyle;
        ctx.fillRect(-8, -8, 16, 16);
        ctx.restore();
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 12px Inter';
        ctx.textAlign = 'center';
        ctx.fillText(setup.type, x, y - 20);
    }

    // Panel Lateral (Radar Histogram)
    const domWidth = 60;
    ctx.fillStyle = 'rgba(10, 10, 12, 0.95)';
    ctx.fillRect(width - domWidth, 0, domWidth, height);
    if (lastT) {
        const snap = state.heatmapData[lastT];
        let localMax = 1;
        for (const r of snap) if (r.s > localMax) localMax = r.s;
        ctx.font = 'bold 10px "Inter", sans-serif';
        for (const row of snap) {
            if (row.s < filterThresh) continue;
            const y = (height * (1 - (row.p - minP) / (maxP - minP)));
            const isAsk = row.p > state.lastTickPrice;
            const barW = (row.s / localMax) * (domWidth - 10);
            ctx.fillStyle = isAsk ? 'rgba(255, 163, 51, 0.3)' : 'rgba(0, 255, 255, 0.3)';
            ctx.fillRect(width - barW, y - 4, barW, 8);
            ctx.fillStyle = isAsk ? '#ffa333' : '#00ffff';
            ctx.textAlign = 'right';
            ctx.fillText(Math.round(row.s).toString(), width - 5, y + 4);
        }
    }
}

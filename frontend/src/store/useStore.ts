import { createWithEqualityFn } from 'zustand/traditional'; // PUGOBOT-SYNC-V14.2.1
import { persist, createJSONStorage, subscribeWithSelector } from 'zustand/middleware';
import axios from 'axios';
import { CandleData, StorageManager } from '../engine/footprint/StorageManager';
import { OrderFlowAnalyzer } from '../engine/orderflow/OrderFlowAnalyzer';

const analyzer = new OrderFlowAnalyzer(0.25);

export type ThemeMode = 'dark' | 'light';

export interface Bar {
  time: any; // Compatible con number (Unix s) y Time (lightweight-charts)
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
}

export interface Drawing {
  id: string;
  type: 'trendline' | 'rectangle' | 'fibonacci' | 'long' | 'short';
  points: { time: number; price: number }[];
  color: string;
  lineWidth: number;
  lineStyle: number; // 0: Solid, 1: Dotted, 2: Dashed
  symbol: string;
}

export interface VwapBand {
  enabled: boolean;
  multiplier: number;
  color: string;
  lineWidth: number;
  lineStyle: number; // 0: Solid, 1: Dotted, 2: Dashed (Lightweight charts line style)
}

export interface AnchoredVwap {
  id: string;
  startTime: number;
  startIndex: number;
  color: string;
  lineWidth: number;
  lineStyle: number;
  bands: VwapBand[];
}

export interface Position {
  ticket: number;
  symbol: string;
  type: 'BUY' | 'SELL';
  volume: number;
  price_open: number;
  sl: number;
  tp: number;
  profit: number;
  comment: string;
}

export interface PendingOrder {
  ticket: number;
  symbol: string;
  type: 'BUY_LIMIT' | 'SELL_LIMIT' | 'OTHER';
  volume: number;
  price_open: number;
  sl: number;
  tp: number;
  comment: string;
}

export interface BigTrade {
  time: number;
  price: number;
  size: number;
  side: 'buy' | 'sell';
}

export interface HeatmapRow {
  p: number; // Precio
  s: number; // Size/Liquidez
}

export interface AccountInfo {
  balance: number;
  equity: number;
  margin_free: number;
  profit: number;
  leverage: number;
  currency: string;
}

export interface SessionZones {
  prev_day: { poc: number; vah: number; val: number; high: number; low: number };
  current_day: { 
    poc: number; 
    vah: number; 
    val: number; 
    cvd?: { time: number, value: number }[];
    vwap?: { time: number, value: number }[];
  };
  initial_balance: { high: number; low: number; start_time?: number; end_time?: number };
  overnight: { 
    high: number; 
    low: number; 
    vwap?: { time: number, value: number }[];
    poc: number;
    vah: number;
    val: number;
    start_time?: number;
    end_time?: number;
    histogram?: any[];
  };
  rth?: {
    poc: number;
    vah: number;
    val: number;
    vwap?: { time: number, value: number }[];
    start_time?: number;
    histogram?: any[];
  };
  gap: { size: number; direction: string; prev_close: number; current_open: number };
  bias: { direction: string; confidence: number };
}

interface TradingState {
  symbol: string;
  timeframe: string;
  data: Bar[];
  drawings: Drawing[];
  isOrderTicketOpen: boolean;
  activeTool: string;
  theme: ThemeMode;
  indicators: {
    sma20: boolean;
    ema50: boolean;
    vwap: boolean;
  };
  pineIndicators: { script: string, results: any, id: string }[];
  pineCode: string;
  watchlist: string[];
  isSymbolSearchOpen: boolean;
  serverOffset: number;
  savedScripts: { id: string, name: string, code: string }[];
  isMarketOpen: boolean;
  mt5Connected: boolean;
  chartRange: string | null;
  isFootprintEnabled: boolean;
  isLoadingFootprint: boolean;
  footprintData: Record<number, Record<number, { bid: number, ask: number }>>;
  footerHeight: number;
  lastTickPrice: number | null;
  lastTickDirection: 1 | -1;
  watchlistPrices: Record<string, { price: number; bid: number; ask: number; error?: string }>;
  drawingsBySymbol: { [symbol: string]: Drawing[] };
  anchoredVwapsBySymbol: { [symbol: string]: AnchoredVwap[] };
  selectedDrawingId: string | null;
  selectedAnchoredVwapId: string | null;
  positionHistory: Position[];
  isSessionZonesEnabled: boolean;
  sessionZonesData: SessionZones | null;
  orderFlowStrategies: {
    deltaDifferential: boolean;
    doubleDelta: boolean;
    macroContext: boolean;
    postNews: boolean;
    volumeProfile: boolean;
    bigTrades: boolean;
    bookmap: boolean;
  };
  strategySignals: Record<number, any>; // Almacén de señales detectadas
  bigTradesData: BigTrade[];
  heatmapData: Record<number, HeatmapRow[]>;
  liveFootprintCandle: CandleData | null;
  dashboardData: Record<string, string>;
  setDashboardData: (data: Record<string, string>) => void;
  setLiveFootprintCandle: (candle: CandleData | null) => void;
  addBigTrade: (trade: BigTrade) => void;
  updateHeatmap: (time: number, data: HeatmapRow[]) => void;
  setHeatmapHistory: (history: any[]) => void;
  clearOrderFlowData: () => void;
  toggleStrategy: (name: keyof TradingState['orderFlowStrategies']) => void;
  fetchHistoricalFootprint: () => Promise<void>;
  
  // Platform Selection
  activePlatform: 'MT5' | 'MT4';
  setActivePlatform: (platform: 'MT5' | 'MT4') => void;
  heatmapFilter: number;
  setHeatmapFilter: (val: number) => void;
  minTradeSize: number;
  setMinTradeSize: (val: number) => void;

  // Trading State
  positions: Position[];
  pendingOrders: PendingOrder[];
  defaultLot: number;
  isTradingSyncing: boolean;
  accountInfo: AccountInfo | null;
  setAccountInfo: (info: AccountInfo | null) => void;
  
  // Pending Limit Order Creation
  isLimitMode: boolean;
  setLimitMode: (active: boolean) => void;
  pendingLimitPrice: number | null;
  setPendingLimitPrice: (price: number | null) => void;
  pendingSL: number | null;
  setPendingSL: (price: number | null) => void;
  pendingTP: number | null;
  setPendingTP: (price: number | null) => void;
  isPendingLimitDragged: boolean;
  setPendingLimitDragged: (dragged: boolean) => void;
  
  // Symbol Metadata for Financial Calcs
  symbolInfo: {
    tickSize: number;
    tickValue: number;
    contractSize: number;
    profitCurrency: string;
  } | null;
  setSymbolInfo: (info: any) => void;

  // Rithmic Config
  rithmicConfig: {
    user: string;
    pass: string;
    system: string;
    connected: boolean;
  };
  setRithmicConfig: (config: Partial<TradingState['rithmicConfig']>) => void;
  isSettingsOpen: boolean;
  setSettingsOpen: (open: boolean) => void;

  // Actions
  setSymbol: (symbol: string) => void;
  setTimeframe: (timeframe: string) => void;
  setServerOffset: (offset: number) => void;
  setMarketOpen: (open: boolean) => void;
  setMT5Connected: (connected: boolean) => void;
  setLastTickPrice: (price: number) => void;
  setChartRange: (range: string | null) => void;
  setFootprintEnabled: (enabled: boolean) => void;
  setIsLoadingFootprint: (loading: boolean) => void;
  clearFootprint: () => void;
  injectHistoricalFootprint: (history: Record<number, Record<number, { bid: number, ask: number }>>) => void;
  addTicksToFootprint: (ticks: any[]) => void;
  addSavedScript: (name: string, code: string) => void;
  deleteSavedScript: (id: string) => void;
  setData: (data: Bar[]) => void;
  backfillSignals: () => void;
  addBar: (bar: Bar) => void;
  toggleIndicator: (name: 'sma20' | 'ema50' | 'vwap') => void;
  setActiveTool: (tool: string) => void;
  setOrderTicketOpen: (open: boolean) => void;
  setSymbolSearchOpen: (open: boolean) => void;
  addToWatchlist: (s: string) => void;
  removeFromWatchlist: (s: string) => void;
  setPineCode: (code: string) => void;
  addPineIndicator: (script: string, results: any) => void;
  toggleTheme: () => void;
  removePineIndicator: (id: string) => void;
  isPineEditorOpen: boolean;
  setPineEditorOpen: (open: boolean) => void;
  addAnchoredVwap: (vwap: Omit<AnchoredVwap, 'id' | 'bands' | 'lineStyle'>) => void;
  removeAnchoredVwap: (id: string | null) => void;
  setSelectedAnchoredVwapId: (id: string | null) => void;
  updateAnchoredVwap: (id: string, updates: Partial<AnchoredVwap>) => void;
  
  addDrawing: (drawing: Omit<Drawing, 'id' | 'symbol'>) => void;
  removeDrawing: (id: string | null) => void;
  updateDrawing: (id: string, updates: Partial<Drawing>) => void;
  setSelectedDrawingId: (id: string | null) => void;
  setPositionHistory: (history: Position[]) => void;
  setSessionZonesEnabled: (enabled: boolean) => void;
  setSessionZonesData: (data: SessionZones | null) => void;
  
  // Trading Actions
  setPositions: (positions: Position[]) => void;
  setPendingOrders: (orders: PendingOrder[]) => void;
  setDefaultLot: (lot: number) => void;
  fetchTradingStatus: () => Promise<void>;
  placeTradingOrder: (data: any) => Promise<any>;
  modifyTradingOrder: (ticket: number, sl: number, tp: number, price?: number) => Promise<any>;
  closeTradingPosition: (ticket: number) => Promise<any>;
  fetchWatchlist: () => Promise<void>;
  fetchTradingHistory: () => Promise<void>;
}

let lastNotifyTime = 0;

export const useStore = createWithEqualityFn<TradingState>()(
  subscribeWithSelector(
    persist(
      (set, get) => ({
      symbol: 'NAS100.fs',
      timeframe: '1m',
      data: [],
      drawingsBySymbol: {},
      anchoredVwapsBySymbol: {},
      selectedDrawingId: null,
      selectedAnchoredVwapId: null,
      positionHistory: [],
      isOrderTicketOpen: false,
      activeTool: 'cursor',
      theme: 'dark',
      indicators: { vwap: false, sma20: false, ema50: false },
      pineIndicators: [],
      pineCode: '',
      watchlist: ['DEMO', 'NAS100.fs', 'ES.fs', 'NQ.fs', 'BTCUSD', 'XAUUSD'],
      isSymbolSearchOpen: false,
      serverOffset: 0,
      savedScripts: [
        {
          id: "svp-ny-v8",
          name: "NY Session Volume Profile",
          code: `// NY Session Volume Profile - Vortex JS (Obrero Optimized v8)\nconst minTick = 0.25; \nconst hhmm = hour.toString().padStart(2, '0') + minute.toString().padStart(2, '0');\nconst inNY = (hhmm >= "0930" && hhmm < "1600");\nconst isNewNY = inNY && !state.prevNY;\nstate.prevNY = inNY;\nif (!state.vp_bins || isNewNY) {\n    state.vp_bins = {};\n    state.total_vol = 0;\n}\nif (inNY) {\n    const tick = minTick || 0.25;\n    const lowB = Math.floor(low / tick) * tick;\n    const highB = Math.ceil(high / tick) * tick;\n    const numB = Math.round((highB - lowB) / tick) + 1;\n    if (numB > 0 && numB < 500) {\n        const vBar = volume / numB;\n        for (let p = lowB; p <= highB; p += tick) {\n            const k = p.toFixed(2);\n            state.vp_bins[k] = (state.vp_bins[k] || 0) + vBar;\n            state.total_vol += vBar;\n        }\n    }\n}\nif (isLast && state.total_vol > 0) {\n    const bins = Object.entries(state.vp_bins).map(([p, v]) => ({ p: parseFloat(p), v: v }));\n    if (bins.length > 0) {\n        let maxV = 0, poc = 0;\n        for(let i=0; i<bins.length; i++) {\n            if(bins[i].v > maxV) { maxV = bins[i].v; poc = bins[i].p; }\n        }\n        state.poc = poc;\n        bins.sort((a, b) => (b.v as any) - (a.v as any));\n        let curV = 0, targetV = state.total_vol * 0.7;\n        let minP = Infinity, maxP = -Infinity;\n        for (let i = 0; i < bins.length; i++) {\n            curV += bins[i].v as any;\n            if (bins[i].p < minP) minP = bins[i].p;\n            if (bins[i].p > maxP) maxP = bins[i].p;\n            if (curV >= targetV) break;\n        }\n        state.vah = maxP; state.val = minP;\n    }\n}\nif (state.poc > 0) {\n    plot(state.poc, { color: "#f23645", title: "POC", linewidth: 2 });\n}`
        },
        {
          id: "flux-edition-pro",
          name: "FLUX EDITION",
          code: `// FLUX EDITION\nconst [vwap, std] = ta.vwap_session(close, volume, isLast && state.bar_index === 0);\n\n// 1. Initial Balance (09:30 - 10:30 NY)\nconst hhmm = hour.toString().padStart(2, '0') + minute.toString().padStart(2, '0');\nconst isNewDay = state.bar_index === 0 || (hhmm === "0930" && state.prev_hhmm !== "0930");\nstate.prev_hhmm = hhmm;\n\nif (isNewDay) {\n    state.ib_high = high;\n    state.ib_low = low;\n}\n\nif (hhmm >= "0930" && hhmm <= "1030") {\n    state.ib_high = Math.max(state.ib_high || high, high);\n    state.ib_low = Math.min(state.ib_low || low, low);\n}\n\nif (state.ib_high) {\n    plot(state.ib_high, { color: "rgba(33, 33, 33, 0.2)", title: "IB High", style: "dotted" });\n    plot(state.ib_low, { color: "rgba(33, 33, 33, 0.2)", title: "IB Low", style: "dotted" });\n}\n\n// 2. Bandas Sigma\nif (!isNaN(vwap)) {\n    plot(vwap, { color: "#BF40BF", title: "VWAP", linewidth: 3 });\n    plot(vwap + std, { color: "rgba(191, 64, 191, 0.2)", title: "Sigma +1", style: "dashed" });\n    plot(vwap - std, { color: "rgba(191, 64, 191, 0.2)", title: "Sigma -1", style: "dashed" });\n    plot(vwap + std * 2, { color: "rgba(191, 64, 191, 0.4)", title: "Sigma +2", style: "dotted" });\n    plot(vwap - std * 2, { color: "rgba(191, 64, 191, 0.4)", title: "Sigma -2", style: "dotted" });\n\n    // 3. Lógica de Color de Velas\n    const isDiscovery = Math.abs(close - vwap) > std * 1.5;\n    barcolor(isDiscovery ? "#BF40BF" : "#000000"); \n    \n    // 4. Señales FVAE\n    const rejectUpper = high > vwap + std * 2 && close < vwap + std * 1.8;\n    const rejectLower = low < vwap - std * 2 && close > vwap - std * 1.8;\n\n    if (rejectUpper) {\n        plotshape({ style: "circle", color: "#BF40BF", location: "abovebar", text: "FVAE" });\n    }\n    if (rejectLower) {\n        plotshape({ style: "diamond", color: "#1E90FF", location: "belowbar" });\n    }\n\n    display("Market State", isDiscovery ? "PRICE DISCOVERY" : "BALANCED");\n}`
        }
      ],
      isMarketOpen: false,
      mt5Connected: false,
      chartRange: null,
      isFootprintEnabled: true,
      isLoadingFootprint: false,
      strategySignals: {},
      footprintData: {},
      footerHeight: 250,
      lastTickPrice: null,
      lastTickDirection: 1,
      watchlistPrices: {},
        orderFlowStrategies: {
          deltaDifferential: false,
          doubleDelta: false,
          macroContext: false,
          postNews: false,
          volumeProfile: false,
          bigTrades: false,
          bookmap: false,
        },
      bigTradesData: [],
      heatmapData: {},
      heatmapFilter: 50,
      minTradeSize: 50,
      activePlatform: 'MT5',
      positions: [],
      pendingOrders: [],
      defaultLot: 0.1,
      isTradingSyncing: false,
      accountInfo: null,
      isLimitMode: false,
      pendingLimitPrice: null,
      pendingSL: null,
      pendingTP: null,
      isPendingLimitDragged: false,
      symbolInfo: null,
      rithmicConfig: {
        user: '',
        pass: '',
        system: 'Rithmic Paper Trading',
        connected: false
      },
      isSettingsOpen: false,
      isPineEditorOpen: false,
      drawings: [],
      liveFootprintCandle: null,
      isSessionZonesEnabled: true,
      sessionZonesData: null,
      dashboardData: {},

      // Acciones del Store
      setDashboardData: (data) => set({ dashboardData: data }),
      setSessionZonesEnabled: (enabled) => set({ isSessionZonesEnabled: enabled }),
      setSessionZonesData: (data) => set({ sessionZonesData: data }),
      setLiveFootprintCandle: (candle) => set({ liveFootprintCandle: candle }),
      addBigTrade: (trade) => set((state) => {
        const tradeTime = trade.time > 2000000000 ? Math.floor(trade.time / 1000) : Math.floor(trade.time);
        const newData = [...state.bigTradesData, { ...trade, time: tradeTime }].slice(-1000);
        return { bigTradesData: newData };
      }),

      updateHeatmap: (time, data) => set((state) => {
        const newHeatmap = { ...state.heatmapData, [time]: data };
        const threshold = Math.floor(Date.now() / 1000) - (45 * 60);
        const times = Object.keys(newHeatmap).map(Number).sort((a, b) => a - b);
        if (times.length > 0 && times[0] < threshold) {
          for (const t of times) { if (t < threshold) delete newHeatmap[t]; else break; }
        }
        if (Object.keys(newHeatmap).length > 3000) {
          const sorted = Object.keys(newHeatmap).map(Number).sort((a,b)=>a-b);
          sorted.slice(0, sorted.length - 2800).forEach(t => delete newHeatmap[t]);
        }
        return { heatmapData: newHeatmap };
      }),

      setHeatmapHistory: (history) => set((state) => {
        let newHeatmap = { ...state.heatmapData };
        const threshold = Math.floor(Date.now() / 1000) - (45 * 60);
        history.forEach(msg => { if (msg.time >= threshold) newHeatmap[msg.time] = msg.data; });
        return { heatmapData: newHeatmap };
      }),

      clearOrderFlowData: () => set({ bigTradesData: [], heatmapData: {} }),
      
      toggleStrategy: (name) => set((state) => ({
        orderFlowStrategies: { ...state.orderFlowStrategies, [name]: !state.orderFlowStrategies[name] }
      })),

      setHeatmapFilter: (val) => set({ heatmapFilter: val }),
      setMinTradeSize: (val) => set((state) => ({ 
        minTradeSize: val, 
        orderFlowStrategies: { ...state.orderFlowStrategies, bigTrades: true } 
      })),
      setActivePlatform: (platform) => set({ activePlatform: platform }),
      setAccountInfo: (info) => set({ accountInfo: info }),
      setLimitMode: (val) => set((state) => ({
        isLimitMode: val,
        pendingLimitPrice: (val && state.lastTickPrice) ? state.lastTickPrice : state.pendingLimitPrice
      })),
      setPendingLimitPrice: (price) => set({ pendingLimitPrice: price }),
      setPendingSL: (price) => set({ pendingSL: price }),
      setPendingTP: (price) => set({ pendingTP: price }),
      setPendingLimitDragged: (locked) => set({ isPendingLimitDragged: locked }),
      setSymbolInfo: (info) => set({ symbolInfo: info }),

      setRithmicConfig: (config) => set((state) => ({
        rithmicConfig: { ...state.rithmicConfig, ...config }
      })),
      setSettingsOpen: (open) => set({ isSettingsOpen: open }),

      setSymbol: (symbol) => {
        set({ 
          symbol, 
          data: [], 
          footprintData: {}, 
          bigTradesData: [], 
          heatmapData: {},
          liveFootprintCandle: null,
          lastTickPrice: null,
          sessionZonesData: null,
          strategySignals: {}
        });
        analyzer.reset(0.25); // Default ES
        get().fetchTradingStatus();
        get().fetchTradingHistory();
        get().fetchHistoricalFootprint(); // Nuevo: Carga local inmediata
      },
      setTimeframe: (timeframe) => {
        set({ timeframe, data: [] });
        get().fetchTradingStatus();
        get().fetchHistoricalFootprint();
      },
      setServerOffset: (offset) => set({ serverOffset: offset }),
      setMarketOpen: (open) => set({ isMarketOpen: open }),
      setMT5Connected: (connected) => set({ mt5Connected: connected }),
      setLastTickPrice: (price) => set((state) => ({
        lastTickPrice: price,
        pendingLimitPrice: (state.isLimitMode && !state.isPendingLimitDragged) ? price : state.pendingLimitPrice
      })),
      setChartRange: (range) => set({ chartRange: range }),
      setFootprintEnabled: (enabled) => {
        set({ isFootprintEnabled: enabled });
        if (enabled) get().fetchHistoricalFootprint();
      },
      setIsLoadingFootprint: (loading) => set({ isLoadingFootprint: loading }),
      
      fetchHistoricalFootprint: async () => {
        const { symbol, timeframe } = get();
        // Guardia temprana para asegurar que el log SIEMPRE aparezca en consola
        console.log(`[Pugobot-DUAL] fetchHistoricalFootprint() iniciado para ${symbol} @ ${timeframe}`);
        if (!symbol) {
            console.log('[Pugobot-DUAL] Abortado: no hay símbolo');
            return;
        }
          
        set({ isLoadingFootprint: true });

        // ============================================================
        // FASE 1: CARGA DESDE INDEXEDDB (Capa Light + Capa Footprint)
        // ============================================================
        
        // Helper: timeout para evitar que Dexie se cuelgue indefinidamente
        const withTimeout = <T,>(promise: Promise<T>, ms: number, fallback: T): Promise<T> => {
            return Promise.race([
                promise,
                new Promise<T>((_, reject) => 
                    setTimeout(() => reject(new Error('IndexedDB timeout')), ms)
                )
            ]).catch(err => {
                console.warn(`[Pugobot-DUAL] IndexedDB timeout/fallback: ${err.message}`);
                return fallback;
            });
        };
        
        // 1a. Cargar barras ligeras (histórico largo, OHLCV + netDelta)
        let lightCandles = await withTimeout(
            StorageManager.getLightCandles(symbol, timeframe as '1m'|'5m', 5000),
            5000,
            [] as any[]
        );

        // --- NUEVO: Fase 0 - Fallback a MT5 si la DB local está vacía ---
        if (lightCandles.length === 0) {
            console.log(`[Pugobot-DUAL] DB vacía para ${symbol}, solicitando historial base a MetaTrader...`);
            try {
                const mt5Resp = await axios.get(`http://127.0.0.1:8000/api/history/${symbol}?timeframe=${timeframe}&count=3000`);
                if (mt5Resp.data && mt5Resp.data.length > 0) {
                    lightCandles = mt5Resp.data.map((d: any) => ({
                        timestamp: Number(d.time),
                        open: Number(d.open), high: Number(d.high), low: Number(d.low), close: Number(d.close),
                        volume: Number(d.tick_volume || d.volume || 0),
                        symbol, timeframe
                    }));
                }
            } catch (e) {
                console.error('[Pugobot-DUAL] Error en fallback de historial:', e);
            }
        }

        const lightBars: Bar[] = lightCandles.map(c => ({
            time: (c.timestamp || c.time) as number,
            open: c.open, high: c.high, low: c.low, close: c.close,
            volume: c.volume
        }));
        
        // 1b. Cargar footprint maps recientes (con priceMap para Order Flow)
        const fpCandles = await withTimeout(
            StorageManager.getFootprintCandles(symbol, timeframe as '1m'|'5m', 2000),
            5000,
            [] as Awaited<ReturnType<typeof StorageManager.getFootprintCandles>>
        );
        const fpData: Record<number, any> = {};
        const fpSignals: Record<number, any> = {};
        
        fpCandles.forEach(c => {
            fpData[c.timestamp] = c.priceMap;
            if (c.signals) fpSignals[c.timestamp] = c.signals;
        });
        
        if (lightBars.length > 0 || fpCandles.length > 0) {
            set({
                data: lightBars.sort((a, b) => (a.time as number) - (b.time as number)),
                strategySignals: fpSignals,
                footprintData: { ...get().footprintData, ...fpData }
            });
            console.log(`[Pugobot-DUAL] Light: ${lightBars.length} barras, Footprint: ${fpCandles.length} maps`);
        }
        
        // Watermark: último timestamp que tenemos en Light
        const watermark = await withTimeout(
            StorageManager.getLightWatermark(symbol, timeframe as '1m'|'5m'),
            3000,
            0
        );
        const sinceTs = watermark;
        
        console.log(`[Pugobot-DUAL] Watermark: ${sinceTs > 0 ? new Date(sinceTs * 1000).toLocaleString() : 'Inicio'}`);

        // ============================================================
        // FASE 2: BACKFILL DESDE RITHMIC (Arquitectura Dual)
        // ============================================================
        try {
          const resp = await axios.get(
            `http://127.0.0.1:8000/api/rithmic/historical-data/${symbol}?timeframe=${timeframe}&since=${sinceTs}`,
            { timeout: 30000 }
          );
          
          const { bars, footprintMaps } = resp.data;
          
          // 2a. Procesar barras agregadas (Capa Light)
          if (bars && Object.keys(bars).length > 0) {
              const newBars: Bar[] = [];
              const lightToSave: any[] = [];
              
              Object.entries(bars).forEach(([ts, b]: [string, any]) => {
                  const t = parseInt(ts);
                  newBars.push({
                      time: t,
                      open: b.open, high: b.high, low: b.low, close: b.close,
                      volume: b.volume
                  });
                  lightToSave.push({
                      timestamp: t, symbol, timeframe: timeframe as '1m'|'5m',
                      open: b.open, high: b.high, low: b.low, close: b.close,
                      volume: b.volume, netDelta: b.netDelta || 0
                  });
              });
              
              // Merge con datos existentes (evitar duplicados)
              const existingTimes = new Set(get().data.map(b => b.time as number));
              const mergedBars = [...get().data];
              newBars.forEach(b => {
                  if (!existingTimes.has(b.time as number)) mergedBars.push(b);
              });
              
              set({ data: mergedBars.sort((a, b) => (a.time as number) - (b.time as number)) });
              StorageManager.bulkPutLightCandles(lightToSave);
              console.log(`[Pugobot-DUAL] +${lightToSave.length} barras agregadas`);
          }
          
          // 2b. Procesar footprint maps (Capa Detalle)
          if (footprintMaps && Object.keys(footprintMaps).length > 0) {
              get().injectHistoricalFootprint(footprintMaps);
              console.log(`[Pugobot-DUAL] +${Object.keys(footprintMaps).length} footprint maps reales`);
          }
          
        } catch (err) {
          console.error("[STORE] Error fetching historical data:", err);
        } finally {
          set({ isLoadingFootprint: false });
        }
      },
      fetchTradingStatus: async () => {
        const { symbol, activePlatform } = get();
        if (!symbol) return;
        set({ isTradingSyncing: true });
        try {
          const [statusRes, tradingRes] = await Promise.all([
            axios.get(`http://127.0.0.1:8000/api/status/${symbol}`),
            axios.get(`http://127.0.0.1:8000/api/trading/status/${symbol}?platform=${activePlatform}`)
          ]);
          set({
            symbolInfo: statusRes.data.status === 'connected' ? {
              tickSize: statusRes.data.tick_size || 0.01,
              tickValue: statusRes.data.tick_value || 0.01,
              contractSize: statusRes.data.contract_size || 1,
              profitCurrency: statusRes.data.profit_currency || 'USD'
            } : get().symbolInfo,
            positions: tradingRes.data.positions || [],
            pendingOrders: tradingRes.data.orders || [],
            accountInfo: tradingRes.data.account || null,
            mt5Connected: true,
            isMarketOpen: true
          });
        } catch (err) { console.error(err); } finally { set({ isTradingSyncing: false }); }
      },

      fetchTradingHistory: async () => {
        const { symbol } = get();
        try {
          const resp = await axios.get(`http://127.0.0.1:8000/api/trading/history/${symbol}`);
          set({ positionHistory: resp.data });
        } catch (err) { console.error(err); }
      },

      placeTradingOrder: async (data) => {
        try {
          const resp = await axios.post(`http://127.0.0.1:8000/api/order`, { ...data, platform: get().activePlatform });
          setTimeout(() => get().fetchTradingStatus(), 1500);
          return resp.data;
        } catch (err) { return { status: "error" }; }
      },

      modifyTradingOrder: async (ticket, sl, tp, price) => {
        try {
          const resp = await axios.post(`http://127.0.0.1:8000/api/trading/modify`, { ticket, sl, tp, price, platform: get().activePlatform });
          get().fetchTradingStatus();
          return resp.data;
        } catch (err) { return { error: "Network error" }; }
      },

      closeTradingPosition: async (ticket) => {
        try {
          const resp = await axios.post(`http://127.0.0.1:8000/api/trading/close`, { ticket, platform: get().activePlatform });
          get().fetchTradingStatus();
          return resp.data;
        } catch (err) { return { error: "Network error" }; }
      },

      fetchWatchlist: async () => {
        const { watchlist } = get();
        try {
          const resp = await axios.get(`http://127.0.0.1:8000/api/watchlist?symbols=${watchlist.join(',')}`);
          set({ watchlistPrices: resp.data });
        } catch (err) { console.error(err); }
      },

      addTicksToFootprint: (ticks) => set((state) => {
        if (!state.symbolInfo || !ticks.length) return state;

        const now = Date.now();
        let shouldNotify = false;
        if (now - lastNotifyTime > 100) {
          lastNotifyTime = now;
          shouldNotify = true;
        }

        // --- CÁLCULO DE TIMEFRAME ROBUSTO (v11.1) ---
        let timeframeSec = 60; // Default a 1m
        const tfStr = (state.timeframe || '1m').toLowerCase();
        if (tfStr.includes('m')) timeframeSec = parseInt(tfStr) * 60;
        else if (tfStr.includes('h')) timeframeSec = parseInt(tfStr) * 3600;
        else if (tfStr.includes('d')) timeframeSec = 24 * 3600;
        else {
            const num = parseInt(tfStr);
            timeframeSec = num < 60 ? num * 60 : num;
        }

        const tickSize = state.symbolInfo.tickSize || 0.25;
        const fp = state.footprintData; // mutación directa

        // --- GESTIÓN DE MEMORIA (v11.1) ---
        const keys = Object.keys(fp);
        if (keys.length > 2000) {
            const sortedKeys = keys.map(Number).sort((a, b) => a - b);
            const toDelete = sortedKeys.slice(0, 500);
            toDelete.forEach(k => delete fp[k]);
        }

        ticks.forEach(tick => {
          let tickS = tick.time > 2000000000 ? Math.floor(tick.time / 1000) : Math.floor(tick.time);
          let cTime = Math.floor(tickS / timeframeSec) * timeframeSec;
          
          if (!fp[cTime]) fp[cTime] = {};

          const pKey = (Math.round(tick.price / tickSize) * tickSize).toFixed(2);
          if (!fp[cTime][pKey]) fp[cTime][pKey] = { bid: 0, ask: 0 };
          
          const side = tick.side || (tick.aggressor === 1 ? 'buy' : 'sell');
          fp[cTime][pKey].bid += (side === 'sell' ? (tick.quantity || tick.volume || 1) : 0);
          fp[cTime][pKey].ask += (side === 'buy' ? (tick.quantity || tick.volume || 1) : 0);
        });
        
        // --- DETECCIÓN REAL-TIME V5 ---
        const affectedTimes = [...new Set(ticks.map(t => {
            let ts = t.time > 2000000000 ? Math.floor(t.time / 1000) : Math.floor(t.time);
            return Math.floor(ts / timeframeSec) * timeframeSec;
        }))];
        
        const nextSignals = { ...state.strategySignals };
        affectedTimes.forEach(t => {
            const bar = state.data.find(b => b.time === t);
            if (bar && fp[t]) {
                const signal = analyzer.analyzeFootprintCandle(bar, fp[t]);
                if (signal) nextSignals[t] = signal;
                else delete nextSignals[t];

                // 💾 PERSISTENCIA V5: Guardar vela + señales en tiempo real
                StorageManager.putCandle({
                    timestamp: t,
                    symbol: state.symbol,
                    timeframe: state.timeframe as '1m' | '5m',
                    open: bar.open, high: bar.high, low: bar.low, close: bar.close,
                    totalVolume: bar.volume || 0,
                    totalDelta: Object.values(fp[t]).reduce((s:any, v:any) => s + (v.ask - v.bid), 0),
                    pocPrice: 0,
                    priceMap: fp[t],
                    signals: signal
                });
            }
        });

        // Solo actualizamos el 'lastTickTime' si ha pasado el umbral de 100ms
        const lastTickTime = shouldNotify ? now : state.lastTickTime;

        return { 
          footprintData: fp,
          strategySignals: nextSignals,
          lastTickTime
        };
      }),

      injectHistoricalFootprint: (data) => set((state) => {
        const nextFootprint = { ...state.footprintData };
        const nextSignals = { ...state.strategySignals };
        const { symbol, timeframe, data: bars } = state;
        const candlesToSave: CandleData[] = [];

        Object.entries(data).forEach(([tStr, incomingLevels]: [string, any]) => {
          const t = parseInt(tStr);
          
          // Fusionar con datos existentes (acumular, no sobreescribir)
          if (!nextFootprint[t]) nextFootprint[t] = {};
          
          Object.entries(incomingLevels).forEach(([price, vols]: [string, any]) => {
            if (!nextFootprint[t][price]) nextFootprint[t][price] = { bid: 0, ask: 0 };
            nextFootprint[t][price].bid += (vols.bid || 0);
            nextFootprint[t][price].ask += (vols.ask || 0);
          });
          
          // Siempre intentar calcular señales (ahora siempre tenemos mapas reales)
          const bar = bars.find(b => b.time === t);
          let signal = null;
          if (bar) {
              signal = analyzer.analyzeFootprintCandle(bar, nextFootprint[t]);
              if (signal) nextSignals[t] = signal;
          }
          
          // Solo guardar si tenemos barra OHLC (datos completos)
          if (bar) {
            candlesToSave.push({
               timestamp: t,
               symbol,
               timeframe: timeframe as '1m' | '5m',
               open: bar.open, high: bar.high, low: bar.low, close: bar.close,
               totalVolume: Object.values(nextFootprint[t]).reduce((s:any, v:any) => s + ((v.bid||0) + (v.ask||0)), 0),
               totalDelta: Object.values(nextFootprint[t]).reduce((s:any, v:any) => s + ((v.ask||0) - (v.bid||0)), 0),
               pocPrice: 0,
               priceMap: nextFootprint[t],
               signals: signal
            });
          }
        });

        if (candlesToSave.length > 0) {
            StorageManager.bulkPutCandles(candlesToSave);
        }

        return { 
            footprintData: nextFootprint,
            strategySignals: nextSignals
        };
      }),

      backfillSignals: () => set((state) => {
        const nextSignals = { ...state.strategySignals };
        const candlesToSave: CandleData[] = [];
        const { footprintData, data, symbol, timeframe } = state;

        data.forEach(bar => {
            const t = bar.time as number;
            const fp = footprintData[t];
            
            // Solo procesar si tenemos footprint map REAL (con múltiples precios)
            // y no hay señal ya calculada
            if (fp && !nextSignals[t] && Object.keys(fp).length > 0) {
                // Detectar si es un mapa real (no un delta plano legacy)
                const hasRealPriceKeys = Object.keys(fp).some(k => !isNaN(parseFloat(k)));
                if (!hasRealPriceKeys) return;
                
                const signal = analyzer.analyzeFootprintCandle(bar, fp);
                if (signal) {
                    nextSignals[t] = signal;
                    candlesToSave.push({
                        timestamp: t,
                        symbol,
                        timeframe: timeframe as '1m' | '5m',
                        open: bar.open, high: bar.high, low: bar.low, close: bar.close,
                        totalVolume: bar.volume || 0,
                        totalDelta: Object.values(fp).reduce((s:any, v:any) => s + ((v.ask||0) - (v.bid||0)), 0),
                        pocPrice: 0,
                        priceMap: fp,
                        signals: signal
                    });
                }
            }
        });

        if (candlesToSave.length > 0) {
            StorageManager.bulkPutCandles(candlesToSave);
            console.log(`[Pugobot-DUAL] Backfill: ${candlesToSave.length} señales retroactivas.`);
        }

        return { strategySignals: nextSignals };
      }),
      clearFootprint: () => set({ footprintData: {} }),
      addSavedScript: (name, code) => set((state) => ({ savedScripts: [...state.savedScripts, { id: Date.now().toString(), name, code }] })),
      deleteSavedScript: (id) => set((state) => ({ savedScripts: state.savedScripts.filter(s => s.id !== id) })),
      setData: (data) => {
          set({ data });
          get().backfillSignals();
      },
      addBar: (bar) => set((state) => {
        const newData = [...state.data];
        if (newData.length > 0 && newData[newData.length - 1].time === bar.time) newData[newData.length - 1] = bar;
        else newData.push(bar);
        return { data: newData };
      }),
      toggleIndicator: (n) => set((s) => ({ indicators: { ...s.indicators, [n]: !s.indicators[n] } })),
      setPineCode: (c) => set({ pineCode: c }),
      addPineIndicator: (s, r) => set((state) => ({ pineIndicators: [...state.pineIndicators, { script: s, results: r, id: Date.now().toString() }] })),
      removePineIndicator: (id) => set((s) => ({ pineIndicators: s.pineIndicators.filter(i => i.id !== id) })),
      setActiveTool: (t) => set({ activeTool: t }),
      setOrderTicketOpen: (o) => set({ isOrderTicketOpen: o }),
      setPineEditorOpen: (o) => set({ isPineEditorOpen: o }),
      setSymbolSearchOpen: (o) => set({ isSymbolSearchOpen: o }),
      addToWatchlist: (s) => set((state) => ({ watchlist: [...new Set([...state.watchlist, s])] })),
      removeFromWatchlist: (s) => set((state) => ({ watchlist: state.watchlist.filter(i => i !== s) })),
      toggleTheme: () => set((s) => ({ theme: s.theme === 'dark' ? 'light' : 'dark' })),
      addAnchoredVwap: (v) => set((state) => {
        const nv = { ...v, id: Math.random().toString(36).substr(2,9), bands: [{enabled:true, multiplier:1, color:'blue', lineWidth:1, lineStyle:2}] };
        return { anchoredVwapsBySymbol: { ...state.anchoredVwapsBySymbol, [state.symbol]: [...(state.anchoredVwapsBySymbol[state.symbol]||[]), nv] } };
      }),
      removeAnchoredVwap: (id) => set((state) => ({ anchoredVwapsBySymbol: { ...state.anchoredVwapsBySymbol, [state.symbol]: (state.anchoredVwapsBySymbol[state.symbol]||[]).filter(v=>v.id!==id) } })),
      setSelectedAnchoredVwapId: (id) => set({ selectedAnchoredVwapId: id }),
      updateAnchoredVwap: (id, u) => set((state) => ({ anchoredVwapsBySymbol: { ...state.anchoredVwapsBySymbol, [state.symbol]: (state.anchoredVwapsBySymbol[state.symbol]||[]).map(v=>v.id===id?{...v,...u}:v) } })),
      addDrawing: (d) => set((state) => {
        const nd = { ...d, id: Math.random().toString(36).substr(2,9), symbol: state.symbol };
        return { drawingsBySymbol: { ...state.drawingsBySymbol, [state.symbol]: [...(state.drawingsBySymbol[state.symbol]||[]), nd] } };
      }),
      removeDrawing: (id) => set((state) => ({ drawingsBySymbol: { ...state.drawingsBySymbol, [state.symbol]: (state.drawingsBySymbol[state.symbol]||[]).filter(d=>d.id!==id) } })),
      updateDrawing: (id, u) => set((state) => ({ drawingsBySymbol: { ...state.drawingsBySymbol, [state.symbol]: (state.drawingsBySymbol[state.symbol]||[]).map(d=>d.id===id?{...d,...u}:d) } })),
      setSelectedDrawingId: (id) => set({ selectedDrawingId: id }),
      setPositionHistory: (h) => set({ positionHistory: h }),
    }),
    {
      name: 'vortex_trading_storage_v5',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        orderFlowStrategies: state.orderFlowStrategies,
        minTradeSize: state.minTradeSize,
        heatmapFilter: state.heatmapFilter,
        drawingsBySymbol: state.drawingsBySymbol,
        anchoredVwapsBySymbol: state.anchoredVwapsBySymbol,
        positionHistory: state.positionHistory,
        theme: state.theme,
        rithmicConfig: state.rithmicConfig,
        watchlist: state.watchlist,
        savedScripts: state.savedScripts,
        pineCode: state.pineCode,
        serverOffset: state.serverOffset,
        sessionZonesData: state.sessionZonesData,
        isSessionZonesEnabled: state.isSessionZonesEnabled
      }),
    }
  )
 )
);

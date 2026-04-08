import { create } from 'zustand';
import axios from 'axios';

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
  orderFlowStrategies: {
    deltaDifferential: boolean;
    doubleDelta: boolean;
    macroContext: boolean;
    postNews: boolean;
    volumeProfile: boolean;
    bigTrades: boolean;
    bookmap: boolean;
  };
  bigTradesData: BigTrade[];
  heatmapData: Record<number, HeatmapRow[]>;
  addBigTrade: (trade: BigTrade) => void;
  updateHeatmap: (time: number, data: HeatmapRow[]) => void;
  setHeatmapHistory: (history: any[]) => void;
  clearOrderFlowData: () => void;
  toggleStrategy: (name: keyof TradingState['orderFlowStrategies']) => void;
  
  // Platform Selection
  activePlatform: 'MT5' | 'MT4';
  setActivePlatform: (platform: 'MT5' | 'MT4') => void;
  
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

export const useStore = create<TradingState>((set, get) => ({
  symbol: 'NAS100.fs',
  timeframe: '1m',
  data: [],
  drawings: [],
  drawingsBySymbol: JSON.parse(localStorage.getItem('vortex_drawings_v2') || '{}'),
  anchoredVwapsBySymbol: JSON.parse(localStorage.getItem('vortex_avwaps_v2') || '{}'),
  selectedDrawingId: null,
  positionHistory: JSON.parse(localStorage.getItem('vortex_history') || '[]'),
  isOrderTicketOpen: false,
  activeTool: 'cursor',
  theme: (localStorage.getItem('theme') as ThemeMode) || 'dark',
  indicators: { vwap: false, sma20: false, ema50: false },
  pineIndicators: [],
  pineCode: localStorage.getItem('vortex_code') || '',
  watchlist: ['NAS100.fs', 'XAUUSD', 'BTCUSD', 'US30', 'EURUSD'],
  isSymbolSearchOpen: false,
  serverOffset: 3,
  isMarketOpen: false,
  mt5Connected: false,
  chartRange: null,
  isFootprintEnabled: false,
  isLoadingFootprint: false,
  footprintData: {},
  footerHeight: 32,
  lastTickPrice: null,
  lastTickDirection: 1,
  watchlistPrices: {},
  selectedAnchoredVwapId: null,
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
  addBigTrade: (trade) => set((state) => {
    const newData = [...state.bigTradesData, trade].slice(-1000); // Max 1000 burbujas
    return { bigTradesData: newData };
  }),
  updateHeatmap: (time, data) => set((state) => {
    const newHeatmap = { ...state.heatmapData, [time]: data };
    // Mantener hasta 1000 snapshots (~16 min a 1/s) para el heatmap 2D histórico
    const times = Object.keys(newHeatmap).map(Number).sort((a, b) => a - b);
    if (times.length > 1000) {
      delete newHeatmap[times[0]];
    }
    return { heatmapData: newHeatmap };
  }),
  setHeatmapHistory: (history: any[]) => set((state) => {
    let newHeatmap = { ...state.heatmapData };
    
    // El historial viene como una lista de mensajes {time, data}
    for (const msg of history) {
      newHeatmap[msg.time] = msg.data;
    }

    // Mantener solo los últimos 1000 snapshots totales
    const times = Object.keys(newHeatmap).map(Number).sort((a, b) => a - b);
    if (times.length > 1000) {
      const toDelete = times.slice(0, times.length - 1000);
      for (const t of toDelete) {
        delete newHeatmap[t];
      }
    }
    
    return { heatmapData: newHeatmap };
  }),
  clearOrderFlowData: () => set({ bigTradesData: [], heatmapData: {} }),
  toggleStrategy: (name) => set((state) => ({
    orderFlowStrategies: { ...state.orderFlowStrategies, [name]: !state.orderFlowStrategies[name] }
  })),

  // Platform Selection
  activePlatform: 'MT5',
  setActivePlatform: (platform) => set({ activePlatform: platform }),

  setSelectedAnchoredVwapId: (id: string | null) => set({ selectedAnchoredVwapId: id, selectedDrawingId: null }),
  
  // Trading State
  fetchWatchlist: async () => {
    const { watchlist } = get();
    if (watchlist.length === 0) return;
    try {
      const resp = await axios.get(`http://localhost:8005/api/watchlist?symbols=${watchlist.join(',')}`);
      set({ watchlistPrices: resp.data });
    } catch (err) {
      console.error("Error fetching watchlist:", err);
    }
  },

  // Trading Defaults
  positions: [],
  pendingOrders: [],
  defaultLot: 0.1,
  isTradingSyncing: false,
  accountInfo: null,
  setAccountInfo: (info) => set({ accountInfo: info }),

  isLimitMode: false,
  setLimitMode: (val) => set((state) => {
    const newState: any = { 
      isLimitMode: val,
      isPendingLimitDragged: val ? false : state.isPendingLimitDragged 
    };
    // Force immediate sync if activating
    if (val && state.lastTickPrice) {
      console.log('[OBRERO:DIAGNOSTIC] Activando Límite - Sync Inmediato:', state.lastTickPrice);
      newState.pendingLimitPrice = state.lastTickPrice;
    }
    return newState;
  }),
  pendingLimitPrice: null,
  setPendingLimitPrice: (price) => set({ pendingLimitPrice: price }),
  pendingSL: null,
  setPendingSL: (price) => set({ pendingSL: price }),
  pendingTP: null,
  setPendingTP: (price) => set({ pendingTP: price }),
  isPendingLimitDragged: false,
  setPendingLimitDragged: (dragged) => set({ isPendingLimitDragged: dragged }),

  symbolInfo: null,
  setSymbolInfo: (info) => set({ symbolInfo: info }),

  rithmicConfig: {
    user: localStorage.getItem('rithmic_user') || '',
    pass: localStorage.getItem('rithmic_pass') || '',
    system: localStorage.getItem('rithmic_system') || 'Rithmic Paper Trading',
    connected: false
  },
  setRithmicConfig: (config) => set((state) => {
    const newConfig = { ...state.rithmicConfig, ...config };
    if (config.user !== undefined) localStorage.setItem('rithmic_user', config.user);
    if (config.pass !== undefined) localStorage.setItem('rithmic_pass', config.pass);
    if (config.system !== undefined) localStorage.setItem('rithmic_system', config.system);
    return { rithmicConfig: newConfig };
  }),
  isSettingsOpen: false,
  setSettingsOpen: (open) => set({ isSettingsOpen: open }),

  setSymbol: (symbol) => {
    set({ symbol, data: [] });
    get().fetchTradingStatus();
    get().fetchTradingHistory();
  },
  setTimeframe: (timeframe) => {
    set({ timeframe, data: [] });
    get().fetchTradingStatus();
  },
  setServerOffset: (offset: number) => set({ serverOffset: offset }),
  setMarketOpen: (isMarketOpen) => set({ isMarketOpen }),
  setMT5Connected: (mt5Connected) => set({ mt5Connected }),
  
  setLastTickPrice: (price) => set((state) => {
    const newState: any = { lastTickPrice: price };
    
    // 🟢 Refuerzo de auto-seguimiento reactivo
    if (state.isLimitMode && !state.isPendingLimitDragged) {
      newState.pendingLimitPrice = price;
    }
    
    return newState;
  }),

  setChartRange: (chartRange) => set({ chartRange }),
  setFootprintEnabled: (isFootprintEnabled) => {
    console.log('== TOGGLE FOOTPRINT:', isFootprintEnabled);
    set({ isFootprintEnabled });
  },
  setIsLoadingFootprint: (isLoadingFootprint) => set({ isLoadingFootprint }),
  
  setPositions: (positions) => set({ positions }),
  setPendingOrders: (pendingOrders) => set({ pendingOrders }),
  setDefaultLot: (defaultLot) => set({ defaultLot }),

  fetchTradingStatus: async () => {
    const { symbol } = get();
    if (!symbol) return;
    
    set({ isTradingSyncing: true });
    try {
      const { activePlatform } = get();
      const [statusRes, tradingRes] = await Promise.all([
        axios.get(`http://localhost:8005/api/status/${symbol}`),
        axios.get(`http://localhost:8005/api/trading/status/${symbol}?platform=${activePlatform}`)
      ]);

      if (statusRes.data.status === 'connected') {
        set({
          symbolInfo: {
            tickSize: statusRes.data.tick_size || 0.01,
            tickValue: statusRes.data.tick_value || 0.01,
            contractSize: statusRes.data.contract_size || 1,
            profitCurrency: statusRes.data.profit_currency || 'USD'
          }
        });
      }

      set({
        positions: tradingRes.data.positions || [],
        pendingOrders: tradingRes.data.orders || [],
        accountInfo: tradingRes.data.account || null,
        mt5Connected: true,
        isMarketOpen: true
      });
    } catch (err) {
      console.error("Error syncing trading status:", err);
    } finally {
      set({ isTradingSyncing: false });
    }
  },

  fetchTradingHistory: async () => {
    const { symbol } = get();
    if (!symbol) return;
    try {
      const resp = await axios.get(`http://localhost:8005/api/trading/history/${symbol}`);
      set({ positionHistory: resp.data });
      localStorage.setItem('vortex_history', JSON.stringify(resp.data));
    } catch (err) {
      console.error("Error fetching trading history:", err);
    }
  },

  placeTradingOrder: async (orderData: any) => {
    const { activePlatform } = get();
    try {
      const resp = await axios.post(`http://127.0.0.1:8005/api/order`, {
        ...orderData,
        platform: activePlatform
      });
      
      if (resp.data.status === 'success') {
        const ticket = resp.data.ticket;
        // Optimistic Update: Añadir posición manual hasta el primer poll
        const optPos: Position = {
          ticket,
          symbol: orderData.symbol,
          type: orderData.type,
          volume: orderData.lot,
          price_open: orderData.price || useStore.getState().lastTickPrice || 0,
          sl: orderData.sl || 0,
          tp: orderData.tp || 0,
          profit: 0,
          comment: "Optimistic"
        };
        
        set(state => ({
          positions: [...state.positions, optPos]
        }));

        // Forzar sync real tras 1.5s (tiempo típico de MT5 para reflejar la posición)
        setTimeout(() => useStore.getState().fetchTradingStatus(), 1500);
      }
      return resp.data;
    } catch (err) {
      console.error("Error placing order:", err);
      return { status: "error", message: "Network error" };
    }
  },

  modifyTradingOrder: async (ticket, sl, tp, price) => {
    const { activePlatform } = get();
    try {
      const resp = await axios.post(`http://127.0.0.1:8005/api/trading/modify`, {
        ticket, sl, tp, price, platform: activePlatform
      });
      useStore.getState().fetchTradingStatus();
      return resp.data;
    } catch (err) {
      console.error("Error modifying order:", err);
      return { error: "Network error" };
    }
  },

  closeTradingPosition: async (ticket) => {
    const { activePlatform } = get();
    try {
      const resp = await axios.post(`http://127.0.0.1:8005/api/trading/close`, { 
        ticket, platform: activePlatform 
      });
      useStore.getState().fetchTradingStatus();
      return resp.data;
    } catch (err) {
      console.error("Error closing position:", err);
      return { error: "Network error" };
    }
  },

  addTicksToFootprint: (ticks: any[]) => set((state) => {
    if (state.data.length === 0) return state;
    
    const timeframeSeconds = (() => {
      const unit = state.timeframe.slice(-1);
      const val = parseInt(state.timeframe);
      if (unit === 'm') return val * 60;
      if (unit === 'h') return val * 3600;
      if (unit === 'd') return val * 86400;
      return 60;
    })();

    const newFootprint = { ...state.footprintData };
    const getTickSize = (p: number) => {
        if (p > 10000) return 5;
        if (p > 1000) return 1;
        if (p > 100) return 0.05;
        if (p > 5) return 0.01;
        return 0.0001;
      };

      let currentLastPrice = state.lastTickPrice !== null ? state.lastTickPrice : (ticks.length > 0 ? (ticks[0].price || ticks[0].bid || 0) : 0);
      let currentLastDirection = state.lastTickDirection || 1;

      ticks.forEach(tick => {
        const tickTimeSec = Math.floor(tick.time / 1000);
        const candleTime = Math.floor(tickTimeSec / timeframeSeconds) * timeframeSeconds;
        
        const price = tick.price || tick.last || (tick.bid && tick.ask ? (tick.bid + tick.ask) / 2 : tick.bid);
        const tickSize = getTickSize(price);
        const roundedPrice = Math.floor(price / tickSize) * tickSize;

        if (!newFootprint[candleTime]) {
          newFootprint[candleTime] = {};
        }
        if (!newFootprint[candleTime][roundedPrice]) {
          newFootprint[candleTime][roundedPrice] = { bid: 0, ask: 0 };
        }

        if (price > currentLastPrice) {
            currentLastDirection = 1;
        } else if (price < currentLastPrice) {
            currentLastDirection = -1;
        }

        if (currentLastDirection === 1) {
            newFootprint[candleTime][roundedPrice].ask += tick.volume || 1;
        } else {
            newFootprint[candleTime][roundedPrice].bid += tick.volume || 1;
        }

        currentLastPrice = price;
      });

      const times = Object.keys(newFootprint).map(Number).sort((a, b) => b - a);
      if (times.length > 1000) {
        times.slice(1000).forEach(t => delete newFootprint[t]);
      }

      return { 
          footprintData: newFootprint,
          lastTickPrice: currentLastPrice,
          lastTickDirection: currentLastDirection as 1 | -1,
          // 🟢 Atomic auto-follow (uses state to avoid closure stale state)
          pendingLimitPrice: (() => {
            const nextPrice = (state.isLimitMode && !state.isPendingLimitDragged) 
              ? currentLastPrice 
              : state.pendingLimitPrice;
            
            if (state.isLimitMode) {
              console.log('[OBRERO:DIAGNOSTIC] Tick Processed:', {
                isLimitMode: state.isLimitMode,
                isDragged: state.isPendingLimitDragged,
                currentLastPrice,
                oldPending: state.pendingLimitPrice,
                nextPending: nextPrice
              });
            }
            return nextPrice;
          })()
      };
    }),
    
  injectHistoricalFootprint: (historyData) => set((state) => {
      const mergedFootprint = { ...historyData, ...state.footprintData };
      const times = Object.keys(mergedFootprint).map(Number).sort((a, b) => b - a);
      if (times.length > 1000) {
          times.slice(1000).forEach(t => delete mergedFootprint[t]);
      }
      return { footprintData: mergedFootprint };
  }),
  
  clearFootprint: () => set({ footprintData: {} }),

  addSavedScript: (name, code) => set((state) => {
    const newScripts = [...state.savedScripts, { id: Date.now().toString(), name, code }];
    localStorage.setItem('vortex_scripts', JSON.stringify(newScripts));
    return { savedScripts: newScripts };
  }),
  deleteSavedScript: (id) => set((state) => {
    const newScripts = state.savedScripts.filter(s => s.id !== id);
    localStorage.setItem('vortex_scripts', JSON.stringify(newScripts));
    return { savedScripts: newScripts };
  }),
  setData: (data) => set({ data }),
  addBar: (bar) => set((state) => {
    const newData = [...state.data];
    if (newData.length > 0 && newData[newData.length - 1].time === bar.time) {
      newData[newData.length - 1] = bar;
    } else {
      newData.push(bar);
    }
    return { data: newData };
  }),
  toggleIndicator: (name) => set((state) => ({
    indicators: { ...state.indicators, [name]: !state.indicators[name] }
  })),
  setPineCode: (code: string) => {
    localStorage.setItem('vortex_code', code);
    set({ pineCode: code });
  },
  addPineIndicator: (script: string, results: any) => set((state) => ({
    pineIndicators: [...state.pineIndicators, { script, results, id: Date.now().toString() }]
  })),
  removePineIndicator: (id: string) => set((state) => ({
    pineIndicators: state.pineIndicators.filter(i => i.id !== id)
  })),
  setActiveTool: (tool) => set({ activeTool: tool, selectedDrawingId: null, selectedAnchoredVwapId: null }),
  setOrderTicketOpen: (isOrderTicketOpen) => set({ isOrderTicketOpen }),
  setPineEditorOpen: (open) => set({ isPineEditorOpen: open }),

  addAnchoredVwap: (vwap) => set((state) => {
    const sym = state.symbol;
    const newVwap: AnchoredVwap = { 
      ...vwap, 
      id: Math.random().toString(36).substr(2, 9),
      lineStyle: 0, 
      bands: [
        { enabled: true, multiplier: 1, color: 'rgba(41, 98, 255, 0.3)', lineWidth: 1, lineStyle: 2 },
        { enabled: true, multiplier: -1, color: 'rgba(41, 98, 255, 0.3)', lineWidth: 1, lineStyle: 2 },
        { enabled: true, multiplier: 2, color: 'rgba(41, 98, 255, 0.5)', lineWidth: 1, lineStyle: 1 },
        { enabled: true, multiplier: -2, color: 'rgba(41, 98, 255, 0.5)', lineWidth: 1, lineStyle: 1 },
      ]
    };
    const newMap = { ...state.anchoredVwapsBySymbol, [sym]: [...(state.anchoredVwapsBySymbol[sym] || []), newVwap] };
    localStorage.setItem('vortex_avwaps_v2', JSON.stringify(newMap));
    return { anchoredVwapsBySymbol: newMap };
  }),
  removeAnchoredVwap: (id) => set((state) => {
    const sym = state.symbol;
    const newItems = (state.anchoredVwapsBySymbol[sym] || []).filter(v => v.id !== id);
    const newMap = { ...state.anchoredVwapsBySymbol, [sym]: newItems };
    localStorage.setItem('vortex_avwaps_v2', JSON.stringify(newMap));
    return { 
      anchoredVwapsBySymbol: newMap,
      selectedAnchoredVwapId: state.selectedAnchoredVwapId === id ? null : state.selectedAnchoredVwapId
    };
  }),
  updateAnchoredVwap: (id, updates) => set((state: any) => {
    const sym = state.symbol;
    const newItems = (state.anchoredVwapsBySymbol[sym] || []).map((v: any) => v.id === id ? { ...v, ...updates } : v);
    const newMap = { ...state.anchoredVwapsBySymbol, [sym]: newItems };
    localStorage.setItem('vortex_avwaps_v2', JSON.stringify(newMap));
    return { anchoredVwapsBySymbol: newMap };
  }),

  addDrawing: (drawing) => set((state) => {
    const sym = state.symbol;
    const newDrawing: Drawing = { ...drawing, id: Math.random().toString(36).substr(2, 9), symbol: sym };
    const newMap = { ...state.drawingsBySymbol, [sym]: [...(state.drawingsBySymbol[sym] || []), newDrawing] };
    localStorage.setItem('vortex_drawings_v2', JSON.stringify(newMap));
    return { drawingsBySymbol: newMap };
  }),
  removeDrawing: (id) => set((state) => {
    const sym = state.symbol;
    const newItems = (state.drawingsBySymbol[sym] || []).filter(d => d.id !== id);
    const newMap = { ...state.drawingsBySymbol, [sym]: newItems };
    localStorage.setItem('vortex_drawings_v2', JSON.stringify(newMap));
    return { 
      drawingsBySymbol: newMap,
      selectedDrawingId: state.selectedDrawingId === id ? null : state.selectedDrawingId
    };
  }),
  updateDrawing: (id, updates) => set((state) => {
    const sym = state.symbol;
    const newItems = (state.drawingsBySymbol[sym] || []).map(d => d.id === id ? { ...d, ...updates } : d);
    const newMap = { ...state.drawingsBySymbol, [sym]: newItems };
    localStorage.setItem('vortex_drawings_v2', JSON.stringify(newMap));
    return { drawingsBySymbol: newMap };
  }),
  setSelectedDrawingId: (id) => set({ selectedDrawingId: id, selectedAnchoredVwapId: null }),
  setPositionHistory: (history) => set((state) => {
    localStorage.setItem('vortex_history', JSON.stringify(history));
    return { positionHistory: history };
  }),

  setSymbolSearchOpen: (open) => set({ isSymbolSearchOpen: open }),
  addToWatchlist: (s) => set((state) => ({ 
    watchlist: state.watchlist.includes(s) ? state.watchlist : [...state.watchlist, s] 
  })),
  removeFromWatchlist: (s) => set((state) => ({
    watchlist: state.watchlist.filter(item => item !== s)
  })),
  toggleTheme: () => set((state) => {
    const newTheme = state.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('theme', newTheme);
    return { theme: newTheme };
  }),

  isPineEditorOpen: false,

  savedScripts: (() => {
    const defaultScripts = [
      {
        id: "svp-ny-v8",
        name: "NY Session Volume Profile",
        code: `// NY Session Volume Profile - Vortex JS (Obrero Optimized v8)\nconst minTick = 0.25; \nconst hhmm = hour.toString().padStart(2, '0') + minute.toString().padStart(2, '0');\nconst inNY = (hhmm >= "0930" && hhmm < "1600");\nconst isNewNY = inNY && !state.prevNY;\nstate.prevNY = inNY;\nif (!state.vp_bins || isNewNY) {\n    state.vp_bins = {};\n    state.total_vol = 0;\n}\nif (inNY) {\n    const tick = minTick || 0.25;\n    const lowB = Math.floor(low / tick) * tick;\n    const highB = Math.ceil(high / tick) * tick;\n    const numB = Math.round((highB - lowB) / tick) + 1;\n    if (numB > 0 && numB < 500) {\n        const vBar = volume / numB;\n        for (let p = lowB; p <= highB; p += tick) {\n            const k = p.toFixed(2);\n            state.vp_bins[k] = (state.vp_bins[k] || 0) + vBar;\n            state.total_vol += vBar;\n        }\n    }\n}\nif (isLast && state.total_vol > 0) {\n    const bins = Object.entries(state.vp_bins).map(([p, v]) => ({ p: parseFloat(p), v: v }));\n    if (bins.length > 0) {\n        let maxV = 0, poc = 0;\n        for(let i=0; i<bins.length; i++) {\n            if(bins[i].v > maxV) { maxV = bins[i].v; poc = bins[i].p; }\n        }\n        state.poc = poc;\n        bins.sort((a, b) => (b.v as any) - (a.v as any));\n        let curV = 0, targetV = state.total_vol * 0.7;\n        let minP = Infinity, maxP = -Infinity;\n        for (let i = 0; i < bins.length; i++) {\n            curV += bins[i].v as any;\n            if (bins[i].p < minP) minP = bins[i].p;\n            if (bins[i].p > maxP) maxP = bins[i].p;\n            if (curV >= targetV) break;\n        }\n        state.vah = maxP; state.val = minP;\n    }\n}\nif (state.poc > 0) {\n    plot(state.poc, { color: "#f23645", title: "POC", linewidth: 2 });\n    plot(state.vah, { color: "#787b86", title: "VAH" });\n    plot(state.val, { color: "#787b86", title: "VAL" });\n}`
      },
      {
        id: "flux-edition-pro",
        name: "FLUX EDITION",
        code: `// FLUX EDITION\nconst [vwap, std] = ta.vwap_session(close, volume, isLast && state.bar_index === 0);\n\n// 1. Initial Balance (09:30 - 10:30 NY)\nconst hhmm = hour.toString().padStart(2, '0') + minute.toString().padStart(2, '0');\nconst isNewDay = state.bar_index === 0 || (hhmm === "0930" && state.prev_hhmm !== "0930");\nstate.prev_hhmm = hhmm;\n\nif (isNewDay) {\n    state.ib_high = high;\n    state.ib_low = low;\n}\n\nif (hhmm >= "0930" && hhmm <= "1030") {\n    state.ib_high = Math.max(state.ib_high || high, high);\n    state.ib_low = Math.min(state.ib_low || low, low);\n}\n\nif (state.ib_high) {\n    plot(state.ib_high, { color: "rgba(120, 123, 134, 0.4)", title: "IB High", style: "dotted" });\n    plot(state.ib_low, { color: "rgba(120, 123, 134, 0.4)", title: "IB Low", style: "dotted" });\n}\n\n// 2. Bandas Sigma\nif (!isNaN(vwap)) {\n    plot(vwap, { color: "#ff9800", title: "VWAP", linewidth: 3 });\n    plot(vwap + std, { color: "rgba(255, 152, 0, 0.3)", title: "Sigma +1", style: "dashed" });\n    plot(vwap - std, { color: "rgba(255, 152, 0, 0.3)", title: "Sigma -1", style: "dashed" });\n    plot(vwap + std * 2, { color: "rgba(255, 152, 0, 0.6)", title: "Sigma +2", style: "dotted" });\n    plot(vwap - std * 2, { color: "rgba(255, 152, 0, 0.6)", title: "Sigma -2", style: "dotted" });\n\n    // 3. Lógica Bloom/Flux de Velas\n    const isDiscovery = Math.abs(close - vwap) > std * 1.5;\n    barcolor(isDiscovery ? "#ff9800" : "#089981"); \n    \n    // 4. Señales FVAE (Point/Diamond)\n    const rejectUpper = high > vwap + std * 2 && close < vwap + std * 1.8;\n    const rejectLower = low < vwap - std * 2 && close > vwap - std * 1.8;\n\n    if (rejectUpper) {\n        plotshape({ style: "circle", color: "#ff9800", location: "abovebar", text: "FVAE" });\n    }\n    if (rejectLower) {\n        plotshape({ style: "diamond", color: "#2962ff", location: "belowbar" });\n    }\n\n    display("Market State", isDiscovery ? "PRICE DISCOVERY" : "BALANCED");\n}`
      }
    ];
    try {
      const userScripts = JSON.parse(localStorage.getItem('vortex_scripts') || '[]');
      const merged = [...defaultScripts];
      userScripts.forEach((us: any) => {
          if (!merged.find(ds => ds.id === us.id)) merged.push(us);
      });
      return merged;
    } catch { return defaultScripts; }
  })(),
}));

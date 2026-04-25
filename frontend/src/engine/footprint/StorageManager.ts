import Dexie, { Table } from 'dexie';

export interface Tick {
  id?: number;
  timestamp: number;
  symbol: string;
  price: number;
  volume: number;
  type: 'bid' | 'ask' | 'trade';
}

export interface CandleData {
  timestamp: number;
  symbol: string;
  timeframe: '1m' | '5m';
  open: number;
  high: number;
  low: number;
  close: number;
  totalVolume: number;
  totalDelta: number;
  pocPrice: number;
  priceMap: Record<number, { bid: number; ask: number } | any>;
  signals?: any;
}

export interface CandleLight {
  timestamp: number;
  symbol: string;
  timeframe: '1m' | '5m';
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  netDelta: number;
}

export class FootprintDatabase extends Dexie {
  ticks!: Table<Tick, number>;
  candles_light!: Table<CandleLight, string[]>;
  candles_footprint!: Table<CandleData, string[]>;

  constructor() {
    super('FootprintDB_v4');
    // IMPORTANTE: Incrementar versión para forzar upgrade y crear tablas nuevas
    // si el navegador ya tenía la DB con un esquema anterior.
    this.version(2).stores({
      ticks: '++id, timestamp, symbol',
      // Capa Light: barras agregadas (histórico largo, eficiente)
      candles_light: '[symbol+timeframe+timestamp], timestamp, symbol, timeframe, [symbol+timeframe]',
      // Capa Detalle: footprint maps con priceMap (solo reciente)
      candles_footprint: '[symbol+timeframe+timestamp], timestamp, symbol, timeframe, [symbol+timeframe]'
    });
  }
}

export const db = new FootprintDatabase();

export class StorageManager {
  static readonly FOOTPRINT_MAX_AGE_HOURS = 48;
  static readonly LIGHT_MAX_AGE_DAYS = 90;

  // ============================================================
  // CAPA LIGHT: Barras agregadas (histórico largo, eficiente)
  // ============================================================
  static async bulkPutLightCandles(candles: CandleLight[]) {
    try {
        await db.candles_light.bulkPut(candles);
        console.log(`[Storage:Light] Guardadas ${candles.length} barras`);
    } catch (e) {
        console.error("[Storage:Light] Error:", e);
    }
  }

  static async getLightCandles(symbol: string, timeframe: '1m' | '5m', limit: number = 5000) {
    try {
        return await db.candles_light
          .where('[symbol+timeframe+timestamp]')
          .between([symbol, timeframe, 0], [symbol, timeframe, Infinity])
          .reverse()
          .limit(limit)
          .toArray();
    } catch (e) {
        console.error("[Storage:Light] Error:", e);
        return [];
    }
  }

  static async getLightWatermark(symbol: string, timeframe: '1m' | '5m'): Promise<number> {
    try {
        const last = await db.candles_light
          .where('[symbol+timeframe+timestamp]')
          .between([symbol, timeframe, 0], [symbol, timeframe, Infinity])
          .reverse()
          .first();
        return last?.timestamp || 0;
    } catch {
        return 0;
    }
  }

  // ============================================================
  // CAPA DETALLE: Footprint maps (solo reciente, con priceMap)
  // ============================================================
  static async putCandle(candle: CandleData) {
    try {
        await db.candles_footprint.put(candle);
    } catch (e) {
        console.error("[Storage:Footprint] Error putCandle:", e);
    }
  }

  static async bulkPutCandles(candles: CandleData[]) {
    try {
        await db.candles_footprint.bulkPut(candles);
        console.log(`[Storage:Footprint] Guardadas ${candles.length} velas`);
    } catch (e) {
        console.error("[Storage:Footprint] Error bulkPut:", e);
    }
  }

  static async getFootprintCandles(symbol: string, timeframe: '1m' | '5m', limit: number = 200) {
    try {
        return await db.candles_footprint
          .where('[symbol+timeframe+timestamp]')
          .between([symbol, timeframe, 0], [symbol, timeframe, Infinity])
          .reverse()
          .limit(limit)
          .toArray();
    } catch (e) {
        console.error("[Storage:Footprint] Error:", e);
        return [];
    }
  }

  // ============================================================
  // LEGACY: Mantener compatibilidad durante transición
  // ============================================================
  static async getHistoricalCandles(symbol: string, timeframe: '1m' | '5m', limit: number = 200) {
    // Priorizar footprint, fallback a light
    const fp = await this.getFootprintCandles(symbol, timeframe, limit);
    if (fp.length > 0) return fp;
    return await this.getLightCandles(symbol, timeframe, limit);
  }

  static async saveTicks(ticks: Tick[]) {
    await db.ticks.bulkAdd(ticks);
    this.purgeOldData('ticks');
  }

  static async clearSymbolData(symbol: string, timeframe: '1m' | '5m') {
    try {
      await db.candles_light.where({ symbol, timeframe }).delete();
      await db.candles_footprint.where({ symbol, timeframe }).delete();
      console.log(`[Storage] Datos limpiados para ${symbol} (${timeframe})`);
    } catch (e) {
      console.error(`Error limpiando datos de ${symbol}:`, e);
    }
  }

  static async purgeOldData(table: 'ticks' | 'footprint' | 'all' = 'all') {
    const now = Date.now() / 1000;
    const fpCutoff = now - (this.FOOTPRINT_MAX_AGE_HOURS * 3600);
    const lightCutoff = now - (this.LIGHT_MAX_AGE_DAYS * 24 * 3600);

    try {
      if (table === 'ticks' || table === 'all') {
        const tickCutoff = Date.now() - (24 * 60 * 60 * 1000);
        const count = await db.ticks.where('timestamp').below(tickCutoff).count();
        if (count > 1000) await db.ticks.where('timestamp').below(tickCutoff).delete();
      }
      
      if (table === 'footprint' || table === 'all') {
        await db.candles_footprint.where('timestamp').below(fpCutoff).delete();
        console.log(`[Storage:Purge] Footprint maps > ${this.FOOTPRINT_MAX_AGE_HOURS}h eliminados`);
      }
      
      if (table === 'all') {
        await db.candles_light.where('timestamp').below(lightCutoff).delete();
        console.log(`[Storage:Purge] Light candles > ${this.LIGHT_MAX_AGE_DAYS}d eliminadas`);
      }
    } catch (e) {
      console.error("Storage Purge Error:", e);
    }
  }
}

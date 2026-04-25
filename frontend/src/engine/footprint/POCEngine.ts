import { Tick, CandleData, StorageManager } from './StorageManager';
import { useStore } from '../../store/useStore';

export class POCEngine {
  private current1mCandle: CandleData | null = null;
  private current5mCandle: CandleData | null = null;
  
  public onCandleUpdate?: (candle1m: CandleData, candle5m: CandleData) => void;

  constructor() {}

  public getLatestCandle(timeframe: string): CandleData | null {
    return timeframe === '5m' ? this.current5mCandle : this.current1mCandle;
  }

  public processTick(tick: Tick) {
    const timestamp1m = this.getStartOfTimeframe(tick.timestamp, 1);
    const timestamp5m = this.getStartOfTimeframe(tick.timestamp, 5);

    this.current1mCandle = this.updateCandle(this.current1mCandle, tick, timestamp1m, '1m');
    this.current5mCandle = this.updateCandle(this.current5mCandle, tick, timestamp5m, '5m');

    // Persistir vela viva
    if (this.current1mCandle) {
        StorageManager.putCandle(this.current1mCandle).catch(() => {});
        // 🟢 Notificación instantánea al Store para el renderer
        useStore.getState().setLiveFootprintCandle(this.current1mCandle);
    }

    if (this.onCandleUpdate) {
      this.onCandleUpdate(this.current1mCandle!, this.current5mCandle!);
    }
  }

  private getStartOfTimeframe(timestamp: number, minutes: number): number {
    const msPeriod = minutes * 60 * 1000;
    return Math.floor(timestamp / msPeriod) * msPeriod;
  }

  private updateCandle(
    existingCandle: CandleData | null, 
    tick: Tick, 
    timeframeStart: number, 
    timeframe: '1m' | '5m'
  ): CandleData {
    if (!existingCandle || existingCandle.timestamp !== timeframeStart) {
      if (existingCandle) StorageManager.putCandle(existingCandle).catch(e => console.error(e));

      existingCandle = {
        timestamp: timeframeStart,
        symbol: tick.symbol,
        timeframe: timeframe,
        open: tick.price,
        high: tick.price,
        low: tick.price,
        close: tick.price,
        totalVolume: 0,
        totalDelta: 0,
        pocPrice: tick.price,
        priceMap: {}
      };
    }

    existingCandle.close = tick.price;
    if (tick.price > existingCandle.high) existingCandle.high = tick.price;
    if (tick.price < existingCandle.low) existingCandle.low = tick.price;

    existingCandle.totalVolume += tick.volume;
    if (tick.type === 'ask') existingCandle.totalDelta += tick.volume;
    if (tick.type === 'bid') existingCandle.totalDelta -= tick.volume;
    
    const priceLevel = tick.price;
    if (!existingCandle.priceMap[priceLevel]) {
      existingCandle.priceMap[priceLevel] = { bidVol: 0, askVol: 0, totalVol: 0 };
    }
    
    const node = existingCandle.priceMap[priceLevel];
    if (tick.type === 'bid') node.bidVol += tick.volume;
    if (tick.type === 'ask') node.askVol += tick.volume;
    node.totalVol += tick.volume;

    const currentPocVolume = existingCandle.priceMap[existingCandle.pocPrice]?.totalVol || 0;
    if (node.totalVol > currentPocVolume) {
      existingCandle.pocPrice = priceLevel;
    } else if (node.totalVol === currentPocVolume && priceLevel > existingCandle.pocPrice) {
       existingCandle.pocPrice = priceLevel;
    }

    return existingCandle;
  }
}

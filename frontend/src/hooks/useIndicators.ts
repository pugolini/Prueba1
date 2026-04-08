import { Bar } from '../store/useStore';

export interface IndicatorResult {
    time: number;
    value: number;
}

export class IndicatorEngine {
    static calculateSMA(data: Bar[], period: number): IndicatorResult[] {
        if (data.length < period) return [];
        const results: IndicatorResult[] = [];
        for (let i = period; i <= data.length; i++) {
            const slice = data.slice(i - period, i);
            const sum = slice.reduce((acc, val) => acc + val.close, 0);
            results.push({
                time: data[i - 1].time,
                value: sum / period
            });
        }
        return results;
    }

    static calculateEMA(data: Bar[], period: number): IndicatorResult[] {
        if (data.length < period) return [];
        const results: IndicatorResult[] = [];
        const k = 2 / (period + 1);
        
        // Initial SMA for first value
        let ema = data.slice(0, period).reduce((acc, val) => acc + val.close, 0) / period;
        results.push({ time: data[period - 1].time, value: ema });

        for (let i = period; i < data.length; i++) {
            ema = (data[i].close - ema) * k + ema;
            results.push({ time: data[i].time, value: ema });
        }
        return results;
    }
}

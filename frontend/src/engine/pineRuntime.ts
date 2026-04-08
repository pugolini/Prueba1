/**
 * Pine Script v6 Simplified Runtime Engine
 * Implements a bar-by-bar execution model for series data.
 */

export class Series {
  private values: number[];
  
  constructor(initialValues: number[] = []) {
    this.values = initialValues;
  }

  get(offset: number = 0): number {
    const idx = this.values.length - 1 - offset;
    return idx >= 0 ? this.values[idx] : NaN;
  }

  push(val: number) {
    this.values.push(val);
  }

  get length() {
    return this.values.length;
  }

  toArray() {
    return [...this.values];
  }
}

export const ta = {
  sma: (source: Series, length: number): number => {
    if (source.length < length) return NaN;
    let sum = 0;
    for (let i = 0; i < length; i++) {
        const val = source.get(i);
        if (isNaN(val)) return NaN;
        sum += val;
    }
    return sum / length;
  },

  ema: (source: Series, length: number, prevEma: number): number => {
    const alpha = 2 / (length + 1);
    const currentPrice = source.get(0);
    if (isNaN(prevEma)) return currentPrice; // Initial SMA seed could be better but this is MVP
    return (currentPrice - prevEma) * alpha + prevEma;
  },

  rsi: (source: Series, length: number, prevAvgGain: number, prevAvgLoss: number): { rsi: number, avgGain: number, avgLoss: number } => {
    if (source.length < 2) return { rsi: NaN, avgGain: NaN, avgLoss: NaN };
    
    const change = source.get(0) - source.get(1);
    const gain = Math.max(0, change);
    const loss = Math.max(0, -change);

    if (isNaN(prevAvgGain)) {
        // First calculation requires full length for seed
        return { rsi: NaN, avgGain: gain, avgLoss: loss }; 
    }

    const avgGain = (prevAvgGain * (length - 1) + gain) / length;
    const avgLoss = (prevAvgLoss * (length - 1) + loss) / length;
    
    if (avgLoss === 0) return { rsi: 100, avgGain, avgLoss };
    const rs = avgGain / avgLoss;
    return { rsi: 100 - (100 / (1 + rs)), avgGain, avgLoss };
  }
};

/**
 * Executes a simplified Pine script string against OHLC data.
 * Supports: plot(ta.sma(close, 20))
 */
export const executePine = (code: string, data: any[]) => {
  // 1. Setup series for built-ins
  const open = new Series();
  const high = new Series();
  const low = new Series();
  const close = new Series();
  
  const results: { [key: string]: number[] } = {};
  
  // 2. Parse code to find plot calls (Very simple regex-based)
  // For now, let's support: plot(ta.sma(close, length), color, title)
  const plotMatches = [...code.matchAll(/plot\((.*)\)/g)];
  if (plotMatches.length === 0) return [];

  // 3. Execution Loop (Bar-by-Bar)
  // We'll store internal states for indicators
  const indicatorStates: any = {};

  for (let i = 0; i < data.length; i++) {
    const bar = data[i];
    open.push(bar.open);
    high.push(bar.high);
    low.push(bar.low);
    close.push(bar.close);

    // Evaluate each plot expression
    plotMatches.forEach((match, plotIdx) => {
        const expression = match[1].split(',')[0].trim();
        let value = NaN;

        // Simple mapping: ta.sma(close, 20)
        if (expression.includes('ta.sma')) {
            const lengthMatch = expression.match(/ta.sma\((\w+),\s*(\d+)\)/);
            if (lengthMatch) {
                const srcName = lengthMatch[1];
                const length = parseInt(lengthMatch[2]);
                const srcSeries = srcName === 'close' ? close : (srcName === 'open' ? open : close);
                value = ta.sma(srcSeries, length);
            }
        } else if (expression.includes('ta.ema')) {
            const lengthMatch = expression.match(/ta.ema\((\w+),\s*(\d+)\)/);
            if (lengthMatch) {
                const length = parseInt(lengthMatch[2]);
                const lastVal = indicatorStates[`ema_${plotIdx}`] || NaN;
                value = ta.ema(close, length, lastVal);
                indicatorStates[`ema_${plotIdx}`] = value;
            }
        } else if (expression === 'close') {
            value = bar.close;
        }

        if (!results[`plot_${plotIdx}`]) results[`plot_${plotIdx}`] = [];
        results[`plot_${plotIdx}`].push(value);
    });
  }

  // 4. Format for ChartComponent
  return Object.keys(results).map((key, idx) => {
    return {
        id: key,
        title: `Pine Indicator ${idx + 1}`,
        values: results[key].map((v, i) => ({ time: data[i].time, value: v }))
    };
  });
};

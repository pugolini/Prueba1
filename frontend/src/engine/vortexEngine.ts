/**
 * Vortex JS Engine: High-Performance Native Scripting for Custom Indicators.
 * Direct JavaScript execution with a trading-optimized API.
 */

export class Series {
    private values: number[];
    constructor(initial: number[] = []) { this.values = initial; }
    get(offset: number = 0): number {
        const idx = this.values.length - 1 - offset;
        return idx >= 0 ? this.values[idx] : NaN;
    }
    push(val: number) { this.values.push(val); }
    get length() { return this.values.length; }
    toArray() { return [...this.values]; }
}

// A series that automatically records its values for stateful indicators
class DynamicSeries extends Series {
    record(val: number) { this.push(val); }
}

const na = NaN;
const math = {
    sqrt: Math.sqrt,
    pow: Math.pow,
    max: Math.max,
    min: Math.min,
    abs: Math.abs,
};

// Vortex JS API: Technical Analysis Library
const ta = {
    _wrap: (src: any, state: any = {}, key: string = 'def') => {
        if (typeof src === 'number') {
            const dsKey = key + '_ds';
            const ds = state[dsKey] || new DynamicSeries();
            ds.record(src);
            state[dsKey] = ds;
            return ds;
        }
        return src;
    },
    sma: (src: any, len: number, state: any = {}, key: string = 'sma') => {
        const s = ta._wrap(src, state, key + '_wrap');
        if (s.length < len) return NaN;
        let sum = 0;
        for (let i = 0; i < len; i++) sum += s.get(i);
        return sum / len;
    },
    ema: (src: any, len: number, state: any = {}, key: string = 'ema') => {
        const s = ta._wrap(src, state, key + '_wrap');
        const alpha = 2 / (len + 1);
        const prev = state[key] ?? s.get(0);
        const val = (s.get(0) - prev) * alpha + prev;
        state[key] = val;
        return val;
    },
    rsi: (src: any, len: number, state: any = {}, key: string = 'rsi') => {
        const s = ta._wrap(src, state, key + '_wrap');
        if (s.length < 2) return NaN;
        const change = s.get(0) - s.get(1);
        const gain = Math.max(0, change);
        const loss = Math.max(0, -change);
        const prevGain = state[key + '_gain'] ?? gain;
        const prevLoss = state[key + '_loss'] ?? loss;
        const avgGain = (prevGain * (len - 1) + gain) / len;
        const avgLoss = (prevLoss * (len - 1) + loss) / len;
        state[key + '_gain'] = avgGain;
        state[key + '_loss'] = avgLoss;
        if (avgLoss === 0) return 100;
        return 100 - (100 / (1 + avgGain / avgLoss));
    },
    vwap_session: (close: any, volume: any, isNewSession: boolean, state: any = {}, key: string = 'vwap') => {
        const c = ta._wrap(close, state, key + '_c');
        const v = ta._wrap(volume, state, key + '_v');
        if (isNewSession) {
            state[key + '_svp'] = 0; state[key + '_sv'] = 0; state[key + '_svp2'] = 0;
        }
        const p_v = c.get(0) * v.get(0);
        const svp = (state[key + '_svp'] || 0) + p_v;
        const sv = (state[key + '_sv'] || 0) + v.get(0);
        const svp2 = (state[key + '_svp2'] || 0) + v.get(0) * Math.pow(c.get(0), 2);
        state[key + '_svp'] = svp; state[key + '_sv'] = sv; state[key + '_svp2'] = svp2;
        const vwap_val = svp / sv;
        const stdev_val = Math.sqrt(Math.max(0, (svp2 / sv) - Math.pow(vwap_val, 2)));
        return [vwap_val, stdev_val];
    },
    stdev: (src: any, len: number, state: any = {}, key: string = 'std') => {
        const s = ta._wrap(src, state, key + '_wrap');
        if (s.length < len) return NaN;
        const avg = ta.sma(s, len, state, key + '_sma');
        let sumSq = 0;
        for (let i = 0; i < len; i++) sumSq += Math.pow(s.get(i) - avg, 2);
        return Math.sqrt(sumSq / len);
    },
    change: (src: any, state: any = {}, key: string = 'chg') => {
        const s = ta._wrap(src, state, key + '_wrap');
        if (s.length < 2) return NaN;
        return s.get(0) - s.get(1);
    },
    barssince: (condition: boolean, state: any = {}, key: string = 'bs') => {
        const lastIndex = state[key] ?? -1;
        const currentIndex = state.bar_index || 0;
        if (condition) {
            state[key] = currentIndex;
            return 0;
        }
        return lastIndex === -1 ? NaN : currentIndex - lastIndex;
    },
    valuewhen: (condition: boolean, src: any, offset: number, state: any = {}, key: string = 'vw') => {
        const s = ta._wrap(src, state, key + '_wrap');
        const history = state[key] || [];
        if (condition) {
            history.unshift(s.get(0));
            if (history.length > offset + 5) history.pop();
            state[key] = history;
        }
        return history[offset] ?? NaN;
    },
    crossover: (src1: any, src2: any, state: any = {}, key: string = 'co') => {
        const s1 = ta._wrap(src1, state, key + '_s1');
        const s2 = ta._wrap(src2, state, key + '_s2');
        if (s1.length < 2 || s2.length < 2) return false;
        return s1.get(1) <= s2.get(1) && s1.get(0) > s2.get(0);
    },
    crossunder: (src1: any, src2: any, state: any = {}, key: string = 'cu') => {
        const s1 = ta._wrap(src1, state, key + '_s1');
        const s2 = ta._wrap(src2, state, key + '_s2');
        if (s1.length < 2 || s2.length < 2) return false;
        return s1.get(1) >= s2.get(1) && s1.get(0) < s2.get(0);
    },
    tr: (high: any, low: any, close: any, state: any = {}, key: string = 'tr') => {
        const h = ta._wrap(high, state, key + '_h');
        const l = ta._wrap(low, state, key + '_l');
        const c = ta._wrap(close, state, key + '_c');
        if (h.length < 1 || l.length < 1 || c.length < 2) return NaN;
        const tr_val = Math.max(h.get(0) - l.get(0), Math.abs(h.get(0) - c.get(1)), Math.abs(l.get(0) - c.get(1)));
        return tr_val;
    },
    atr: (len: number, state: any = {}, key: string = 'atr') => {
        // Simple implementation using SMA of TR
        // Need to pass high, low, close implicitly from the evaluation scope or via state
        // In this engine, we use 'series_high', etc. from the evalFn scope
        const tr_val = ta.tr(state.series_high, state.series_low, state.series_close, state, key + '_tr');
        return ta.sma(tr_val, len, state, key + '_sma');
    },
    cum: (src: any, state: any = {}, key: string = 'cum') => {
        const s = ta._wrap(src, state, key + '_wrap');
        const prev = state[key] ?? 0;
        const val = prev + s.get(0);
        state[key] = val;
        return val;
    }
};



export const executeVortexJS = (code: string, data: any[], serverOffset: number = 0, theme: string = 'dark') => {
    const lineSeries: { [key: string]: any[] } = {};
    const markers: any[] = [];
    const barColors: any[] = [];
    const state: any = {};
    let callCounter = 0;

    // Virtual environment for the script
    const openSeries = new Series();
    const highSeries = new Series();
    const lowSeries = new Series();
    const closeSeries = new Series();
    const volumeSeries = new Series();
    
    // NY Time formatter for session logic
    const nyFormatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'America/New_York',
        hour: 'numeric',
        minute: 'numeric',
        hour12: false
    });

    // 1. Script Pre-processing: Inject state keys into ta.* calls automatically
    let processedCode = code;

    const taRegex = /ta\.(\w+)\(/g;
    let match;
    const injections: { pos: number, text: string }[] = [];

    while ((match = taRegex.exec(code)) !== null) {
        let depth = 1;
        let i = taRegex.lastIndex;
        let argsStart = i;
        while (depth > 0 && i < code.length) {
            if (code[i] === '(') depth++;
            else if (code[i] === ')') depth--;
            i++;
        }
        const args = code.slice(argsStart, i - 1);
        if (!args.includes('state')) {
            injections.push({ pos: i - 1, text: `, state, "call_${callCounter++}"` });
        }
    }

    // Apply injections from back to front to keep positions valid
    for (let i = injections.length - 1; i >= 0; i--) {
        const inj = injections[i];
        processedCode = processedCode.slice(0, inj.pos) + inj.text + processedCode.slice(inj.pos);
    }

    const evalFn = new Function(
        'open', 'high', 'low', 'close', 'volume', 'time',
        'ta', 'math', 'na', 'state', 'bar_index',
        'hour', 'minute', 'theme',
        'plot', 'plotshape', 'barcolor', 'fill',
        'series_open', 'series_high', 'series_low', 'series_close', 'series_volume',
        'display', 'isLast',
        `try { 
            ${processedCode} 
        } catch (e) { 
            if (bar_index === 0) {
                console.group("Vortex Script Error");
                console.error(e);
                console.log("Processed Code:", \`${processedCode.replace(/`/g, '\\`')}\`);
                console.groupEnd();
            }
        }`
    );


    const dashboard: { [key: string]: string } = {};
    const fills: any[] = [];

    for (let i = 0; i < data.length; i++) {
        const bar = data[i];
        const barTime = bar.time;
        
        openSeries.push(bar.open);
        highSeries.push(bar.high);
        lowSeries.push(bar.low);
        closeSeries.push(bar.close);
        volumeSeries.push(bar.volume || 1);

        state.bar_index = i;
        state.series_open = openSeries;
        state.series_high = highSeries;
        state.series_low = lowSeries;
        state.series_close = closeSeries;
        state.series_volume = volumeSeries;


        // Smart Color handling for contrast
        const getContrastColor = (color: string) => {
            if (!color) return color;
            const c = color.toLowerCase();
            if (theme === 'light') {
                if (c === '#ffffff' || c === '#fff' || c === 'white') return '#131722';
            } else {
                if (c === '#000000' || c === '#000' || c === 'black' || c === '#131722') return '#ffffff';
            }
            return color;
        };

        const plot = (val: any, options: any = {}) => {
            if (val === null || isNaN(val)) return null;
            const title = options.title || 'Plot';
            if (!lineSeries[title]) {
                lineSeries[title] = [];
                // Store metadata for the series on the first call
                (lineSeries[title] as any).metadata = {
                    color: getContrastColor(options.color),
                    style: options.style,
                    linewidth: options.linewidth
                };
            }
            lineSeries[title].push({ time: barTime, value: val });
            return title;
        };

        const fill = (s1: string, s2: string, options: any = {}) => {
            if (i === 0 && s1 && s2) { // Solo registramos la intención una vez
                fills.push({ s1, s2, color: options.color });
            }
        };

        const plotshape = (options: any = {}) => {
            if (!options.text && !options.style) return;
            // Default shape based on location
            let shape = options.location === 'belowbar' ? 'arrowUp' : 'arrowDown';
            let text = options.text;

            if (options.style === 'triangleUp' || options.style === 'arrowUp' || options.style === 'labelup') shape = 'arrowUp';
            else if (options.style === 'triangleDown' || options.style === 'arrowDown' || options.style === 'labeldown') shape = 'arrowDown';
            else if (options.style === 'circle') shape = 'circle';
            else if (options.style === 'diamond') {
                shape = 'circle';
                if (!text) text = "◆";
            }
            else if (options.style === 'xcross' || options.style === 'cross' || options.style === 'flag') shape = 'square'; 

            markers.push({
                time: barTime,
                position: options.location === 'belowbar' ? 'belowBar' : 'aboveBar',
                color: getContrastColor(options.color || '#2962ff'),
                shape: shape as any,
                text: text,
            });
        };
        const barcolor = (options: any = {}) => {
            const color = typeof options === 'string' ? options : options.color;
            if (color) barColors.push({ time: barTime, color: getContrastColor(color) });
        };

        const display = (key: string, value: string) => {
            dashboard[key] = value;
        };

        // Calculate NY Time for this bar
        const utcDate = new Date((barTime - serverOffset * 3600) * 1000);
        const parts = nyFormatter.formatToParts(utcDate);
        const hour = parseInt(parts.find(p => p.type === 'hour')?.value || '0');
        const minute = parseInt(parts.find(p => p.type === 'minute')?.value || '0');

        try {
            evalFn(
                bar.open, bar.high, bar.low, bar.close, bar.volume || 1, barTime,
                ta, math, na, state, i,
                hour, minute, theme,
                plot, plotshape, barcolor, fill,
                openSeries, highSeries, lowSeries, closeSeries, volumeSeries,
                display, (i === data.length - 1)
            );
        } catch (e) { 
            if (i === 0) {
                console.group("Vortex Script Error");
                console.error(e);
                console.log("Processed Code:", `${processedCode.replace(/`/g, '\\`')}`);
                console.groupEnd();
            }
        }
    }


    return {
        lineSeries: Object.keys(lineSeries).map(title => {
            const series = lineSeries[title];
            const meta = (series as any).metadata || {};
            return {
                title,
                color: meta.color,
                style: meta.style,
                linewidth: meta.linewidth,
                data: series
            };
        }),
        markers,
        barColors,
        dashboard,
        fills
    };


};

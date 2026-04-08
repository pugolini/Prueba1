import { ISeriesPrimitive, ISeriesPrimitivePaneView, ISeriesPrimitivePaneRenderer, ISeriesApi, IChartApi, Time } from 'lightweight-charts';

class AnchoredVwapRenderer implements ISeriesPrimitivePaneRenderer {
    constructor(
        private _points: { x: number, y: number }[],
        private _bandsPoints: Record<number, { x: number, y: number }[]>,
        private _anchor: { x: number, y: number } | null,
        private _color: string,
        private _width: number,
        private _bands: any[]
    ) {}

    draw(target: any) {
        if (this._points.length < 2) return;
        target.useBitmapCoordinateSpace((scope: any) => {
            const ctx = scope.context;
            const horizontalPixelRatio = scope.horizontalPixelRatio;
            const verticalPixelRatio = scope.verticalPixelRatio;

            // 1. Draw VWAP Line
            ctx.beginPath();
            ctx.strokeStyle = this._color;
            ctx.lineWidth = this._width * horizontalPixelRatio;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';

            this._points.forEach((p, i) => {
                const x = p.x * horizontalPixelRatio;
                const y = p.y * verticalPixelRatio;
                if (i === 0) ctx.moveTo(x, y);
                else ctx.lineTo(x, y);
            });
            ctx.stroke();

            // 1.5 Draw Bands
            this._bands.forEach(b => {
                if (!b.enabled) return;
                const points = this._bandsPoints[b.multiplier];
                if (!points || points.length < 2) return;

                ctx.beginPath();
                ctx.strokeStyle = b.color || this._color;
                ctx.lineWidth = (b.lineWidth || 1) * horizontalPixelRatio;
                if (b.lineStyle === 1) ctx.setLineDash([5, 5]);
                
                points.forEach((p, i) => {
                    const x = p.x * horizontalPixelRatio;
                    const y = p.y * verticalPixelRatio;
                    if (i === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                });
                ctx.stroke();
                ctx.setLineDash([]);
            });

            // 2. Draw Anchor Point (If visible)
            if (this._anchor) {
                const ax = this._anchor.x * horizontalPixelRatio;
                const ay = this._anchor.y * verticalPixelRatio;
                
                // Outer Glow
                ctx.beginPath();
                ctx.arc(ax, ay, 8 * horizontalPixelRatio, 0, Math.PI * 2);
                ctx.fillStyle = 'rgba(255, 152, 0, 0.2)';
                ctx.fill();

                // Inner Dot
                ctx.beginPath();
                ctx.arc(ax, ay, 4 * horizontalPixelRatio, 0, Math.PI * 2);
                ctx.fillStyle = '#FF9800';
                ctx.fill();
                ctx.strokeStyle = '#ffffff';
                ctx.lineWidth = 1.5 * horizontalPixelRatio;
                ctx.stroke();
            }
        });
    }
}

class AnchoredVwapPaneView implements ISeriesPrimitivePaneView {
    constructor(private _source: AnchoredVwapPrimitive) {}
    renderer() {
        // Here we perform the mapping JUST before rendering, ensuring perfect sync with the chart's current state
        const chart = this._source.chart;
        const series = this._source.series;
        if (!chart || !series || !this._source.visible) return null;

        const timeScale = chart.timeScale();
        const vwapPrices = this._source.vwapPrices;
        const bandsPrices = this._source.bandsPrices;
        const anchorPrice = this._source.anchorPrice;

        const points = vwapPrices.map(p => ({
            x: timeScale.timeToCoordinate(p.time) ?? -1000,
            y: series.priceToCoordinate(p.price) ?? -1000
        })).filter(p => p.x > -500 && p.x < 3000); // Simple culling

        const bandsPoints: Record<number, { x: number, y: number }[]> = {};
        Object.keys(bandsPrices).forEach(m => {
            const multiplier = Number(m);
            bandsPoints[multiplier] = bandsPrices[multiplier].map(p => ({
                x: timeScale.timeToCoordinate(p.time) ?? -1000,
                y: series.priceToCoordinate(p.price) ?? -1000
            })).filter(p => p.x > -500 && p.x < 3000);
        });

        let anchorPoint = null;
        if (anchorPrice) {
            anchorPoint = {
                x: timeScale.timeToCoordinate(anchorPrice.time) ?? -1000,
                y: series.priceToCoordinate(anchorPrice.price) ?? -1000
            };
            if (anchorPoint.x < -500 || anchorPoint.x > 3000) anchorPoint = null;
        }

        return new AnchoredVwapRenderer(
            points,
            bandsPoints,
            anchorPoint,
            this._source.parameters.color,
            this._source.parameters.width,
            this._source.bands
        );
    }
}

export class AnchoredVwapPrimitive implements ISeriesPrimitive {
    private _paneViews: AnchoredVwapPaneView[];
    public chart: IChartApi | null = null;
    public series: ISeriesApi<any> | null = null;
    public requestUpdate?: () => void;
    public visible: boolean = true;

    // Prices cache
    public vwapPrices: { time: Time, price: number }[] = [];
    public bandsPrices: Record<number, { time: Time, price: number }[]> = {};
    public anchorPrice: { time: Time, price: number } | null = null;

    // Change tracking
    private _lastDataLength: number = 0;
    private _lastLastBarTime: number = 0;
    private _lastStartTime: number = 0;

    constructor(
        public startTime: number,
        private _data: any[],
        public parameters: { color: string, width: number },
        public bands: any[] = []
    ) {
        this._paneViews = [new AnchoredVwapPaneView(this)];
        this._calculatePrices();
    }

    set data(val: any[]) {
        this._data = val;
        this._calculatePrices();
        if (this.requestUpdate) this.requestUpdate();
    }

    get data() { return this._data; }

    attached({ chart, series, requestUpdate }: any) {
        this.chart = chart;
        this.series = series;
        this.requestUpdate = requestUpdate;
    }

    detached() {
        this.chart = null;
        this.series = null;
        this.requestUpdate = undefined;
    }

    updateAllViews() {
        // No-op here, PaneView.renderer handles it for perfect sync
    }

    update() {
        this._calculatePrices();
        if (this.requestUpdate) this.requestUpdate();
    }

    paneViews() {
        return this._paneViews;
    }

    private _calculatePrices() {
        if (this._data.length === 0) return;

        const lastBar = this._data[this._data.length - 1];
        const lastBarTime = (lastBar.time as number);
        
        const needsCalc = 
            this._data.length !== this._lastDataLength || 
            lastBarTime !== this._lastLastBarTime || 
            this.startTime !== this._lastStartTime;

        if (!needsCalc && this.vwapPrices.length > 0) return;

        const vwapPrices: { time: Time, price: number }[] = [];
        const bandsPrices: Record<number, { time: Time, price: number }[]> = {};
        this.bands.forEach(b => { if (b.enabled) bandsPrices[b.multiplier] = []; });

        let cumPv = 0;
        let cumV = 0;
        let cumP2V = 0;
        let anchorFound = false;

        for (const bar of this._data) {
            if ((bar.time as number) < this.startTime) continue;
            
            const price = (bar.high + bar.low + bar.close) / 3;
            if (!anchorFound) {
                anchorFound = true;
                this.anchorPrice = { time: bar.time, price: bar.high };
            }

            cumPv += price * bar.volume;
            cumV += bar.volume;
            cumP2V += price * price * bar.volume;

            const vwapPrice = cumPv / cumV;
            const variance = (cumP2V / cumV) - (vwapPrice * vwapPrice);
            const stdDev = Math.sqrt(Math.max(0, variance));

            vwapPrices.push({ time: bar.time, price: vwapPrice });
            this.bands.forEach(b => {
                if (b.enabled) {
                    bandsPrices[b.multiplier].push({ 
                        time: bar.time, 
                        price: vwapPrice + (stdDev * b.multiplier) 
                    });
                }
            });
        }
        this.vwapPrices = vwapPrices;
        this.bandsPrices = bandsPrices;
        this._lastDataLength = this._data.length;
        this._lastLastBarTime = lastBarTime;
        this._lastStartTime = this.startTime;
    }
}

import { ISeriesPrimitive, ISeriesPrimitivePaneView, ISeriesPrimitivePaneRenderer, ISeriesApi, IChartApi, Time } from 'lightweight-charts';
import { Point } from './PluginHelpers';

const FIB_LEVELS = [0, 0.236, 0.382, 0.5, 0.618, 0.786, 1];

class FibonacciRenderer implements ISeriesPrimitivePaneRenderer {
    constructor(
        private _p1: { x: number, y: number } | null,
        private _p2: { x: number, y: number } | null,
        private _color: string,
        private _width: number,
        private _selected: boolean,
    ) {}

    draw(target: any) {
        if (!this._p1 || !this._p2) return;
        target.useBitmapCoordinateSpace((scope: any) => {
            const ctx = scope.context;
            const x1 = this._p1!.x * scope.horizontalPixelRatio;
            const x2 = this._p2!.x * scope.horizontalPixelRatio;
            const y1 = this._p1!.y * scope.verticalPixelRatio;
            const y2 = this._p2!.y * scope.verticalPixelRatio;

            const startX = Math.min(x1, x2);
            const endX = Math.max(x1, x2);
            const diffY = y2 - y1;

            ctx.save();
            ctx.font = `${10 * scope.verticalPixelRatio}px Inter, sans-serif`;
            ctx.lineWidth = this._width * scope.verticalPixelRatio;

            FIB_LEVELS.forEach(level => {
                const y = y1 + diffY * level;
                
                // Draw Level Line
                ctx.beginPath();
                ctx.strokeStyle = this._color;
                ctx.globalAlpha = 0.5;
                ctx.moveTo(startX, y);
                ctx.lineTo(endX, y);
                ctx.stroke();

                // Draw Label
                ctx.globalAlpha = 1.0;
                ctx.fillStyle = this._color;
                const label = `${(level * 100).toFixed(1)}%`;
                ctx.fillText(label, endX + 5 * scope.horizontalPixelRatio, y + 4 * scope.verticalPixelRatio);
            });

            // Handles
            if (this._selected) {
                const radius = 4 * scope.horizontalPixelRatio;
                const centerRadius = 5 * scope.horizontalPixelRatio;
                
                const drawHandle = (hx: number, hy: number, isCenter: boolean = false) => {
                    ctx.beginPath();
                    ctx.fillStyle = isCenter ? this._color : '#ffffff';
                    ctx.strokeStyle = isCenter ? '#ffffff' : this._color;
                    ctx.lineWidth = 2 * scope.horizontalPixelRatio;
                    ctx.arc(hx, hy, isCenter ? centerRadius : radius, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                };

                drawHandle(x1, y1);
                drawHandle(x2, y2);
                drawHandle((x1 + x2) / 2, (y1 + y2) / 2, true);
            }

            ctx.restore();
        });
    }
}

class FibonacciView implements ISeriesPrimitivePaneView {
    private _p1: { x: number, y: number } | null = null;
    private _p2: { x: number, y: number } | null = null;

    constructor(private _source: FibonacciPrimitive) {}

    update() {
        const { chart, series, points } = this._source;
        if (!chart || !series || points.length < 2) return;

        const timeScale = chart.timeScale();
        const p1X = timeScale.timeToCoordinate(points[0].time as Time);
        const p1Y = series.priceToCoordinate(points[0].price);
        const p2X = timeScale.timeToCoordinate(points[1].time as Time);
        const p2Y = series.priceToCoordinate(points[1].price);

        this._p1 = (p1X !== null && p1Y !== null) ? { x: p1X, y: p1Y } : null;
        this._p2 = (p2X !== null && p2Y !== null) ? { x: p2X, y: p2Y } : null;
    }

    renderer() {
        return new FibonacciRenderer(this._p1, this._p2, this._source.parameters.color, this._source.parameters.width, this._source.selected);
    }
}

export class FibonacciPrimitive implements ISeriesPrimitive {
    private _view = new FibonacciView(this);
    public chart: IChartApi | null = null;
    public series: ISeriesApi<'Candlestick' | 'Line'> | null = null;
    public selected: boolean = false;

    constructor(
        public points: Point[],
        public parameters: { color: string, width: number }
    ) {}

    attached({ chart, series }: any) {
        this.chart = chart;
        this.series = series;
    }

    detached() {
        this.chart = null;
        this.series = null;
    }

    updateAllViews() {
        this._view.update();
    }

    paneViews() {
        return [this._view];
    }
}

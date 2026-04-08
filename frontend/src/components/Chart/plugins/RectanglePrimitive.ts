import { ISeriesPrimitive, ISeriesPrimitivePaneView, ISeriesPrimitivePaneRenderer, CanvasRenderingTarget2D, ISeriesApi, IChartApi, Coordinate, Time } from 'lightweight-charts';
import { Point } from './PluginHelpers';

class RectangleRenderer implements ISeriesPrimitivePaneRenderer {
    constructor(
        private _p1: { x: number, y: number } | null,
        private _p2: { x: number, y: number } | null,
        private _color: string,
        private _width: number,
        private _fillColor: string
    ) {}

    draw(target: CanvasRenderingTarget2D) {
        if (!this._p1 || !this._p2) return;
        target.useBitmapCoordinateSpace(scope => {
            const ctx = scope.context;
            const x1 = this._p1!.x * scope.horizontalPixelRatio;
            const y1 = this._p1!.y * scope.verticalPixelRatio;
            const x2 = this._p2!.x * scope.horizontalPixelRatio;
            const y2 = this._p2!.y * scope.verticalPixelRatio;

            const x = Math.min(x1, x2);
            const y = Math.min(y1, y2);
            const w = Math.abs(x1 - x2);
            const h = Math.abs(y1 - y2);

            ctx.save();
            ctx.beginPath();
            
            // Fill
            if (this._fillColor && this._fillColor !== 'transparent') {
                ctx.fillStyle = this._fillColor;
                ctx.fillRect(x, y, w, h);
            }

            // Stroke
            ctx.strokeStyle = this._color;
            ctx.lineWidth = this._width * scope.verticalPixelRatio;
            ctx.strokeRect(x, y, w, h);
            
            ctx.restore();
        });
    }
}

class RectangleView implements ISeriesPrimitivePaneView {
    private _p1: { x: number, y: number } | null = null;
    private _p2: { x: number, y: number } | null = null;

    constructor(private _source: RectanglePrimitive) {}

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
        return new RectangleRenderer(
            this._p1, this._p2, 
            this._source.parameters.color, 
            this._source.parameters.width, 
            this._source.parameters.fillColor || 'rgba(41, 98, 255, 0.1)'
        );
    }
}

export class RectanglePrimitive implements ISeriesPrimitive {
    private _view = new RectangleView(this);
    public chart: IChartApi | null = null;
    public series: ISeriesApi<'Candlestick' | 'Line'> | null = null;

    constructor(
        public points: Point[],
        public parameters: { color: string, width: number, fillColor?: string }
    ) {}

    attached({ chart, series }: { chart: IChartApi, series: ISeriesApi<'Candlestick' | 'Line'> }) {
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

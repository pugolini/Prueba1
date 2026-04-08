import { ISeriesPrimitive, ISeriesPrimitivePaneView, ISeriesPrimitivePaneRenderer, CanvasRenderingTarget2D, ISeriesApi, IChartApi, Coordinate, Time } from 'lightweight-charts';
import { Point, drawLine } from './PluginHelpers';

class TrendlineRenderer implements ISeriesPrimitivePaneRenderer {
    constructor(
        private _p1: { x: number, y: number } | null,
        private _p2: { x: number, y: number } | null,
        private _color: string,
        private _width: number,
        private _style: number
    ) {}

    draw(target: CanvasRenderingTarget2D) {
        if (!this._p1 || !this._p2) return;
        target.useBitmapCoordinateSpace(scope => {
            const ctx = scope.context;
            const x1 = this._p1!.x * scope.horizontalPixelRatio;
            const y1 = this._p1!.y * scope.verticalPixelRatio;
            const x2 = this._p2!.x * scope.horizontalPixelRatio;
            const y2 = this._p2!.y * scope.verticalPixelRatio;
            drawLine(ctx, x1, y1, x2, y2, this._color, this._width * scope.verticalPixelRatio, this._style);
        });
    }
}

class TrendlineView implements ISeriesPrimitivePaneView {
    private _p1: { x: number, y: number } | null = null;
    private _p2: { x: number, y: number } | null = null;

    constructor(private _source: TrendlinePrimitive) {}

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
        return new TrendlineRenderer(
            this._p1, this._p2, 
            this._source.parameters.color, 
            this._source.parameters.width, 
            this._source.parameters.style
        );
    }
}

export class TrendlinePrimitive implements ISeriesPrimitive {
    private _view = new TrendlineView(this);
    public chart: IChartApi | null = null;
    public series: ISeriesApi<'Candlestick' | 'Line'> | null = null;

    constructor(
        public points: Point[],
        public parameters: { color: string, width: number, style: number }
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

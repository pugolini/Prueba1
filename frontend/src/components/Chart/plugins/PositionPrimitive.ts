import { ISeriesPrimitive, ISeriesPrimitivePaneView, ISeriesPrimitivePaneRenderer, ISeriesApi, IChartApi, Time } from 'lightweight-charts';
import { Point } from './PluginHelpers';

class PositionRenderer implements ISeriesPrimitivePaneRenderer {
    constructor(
        private _p1: { x: number, y: number } | null,
        private _p2: { x: number, y: number } | null,
        private _type: 'long' | 'short',
        private _color: string,
        private _width: number,
    ) {}

    draw(target: any) {
        if (!this._p1 || !this._p2) return;
        target.useBitmapCoordinateSpace((scope: any) => {
            const ctx = scope.context;
            const x1 = this._p1!.x * scope.horizontalPixelRatio;
            const x2 = this._p2!.x * scope.horizontalPixelRatio;
            const y1 = this._p1!.y * scope.verticalPixelRatio; // Entry
            const y2 = this._p2!.y * scope.verticalPixelRatio; // Target/Stop Boundary

            const startX = Math.min(x1, x2);
            const endX = Math.max(x1, x2);
            const width = endX - startX;
            
            // In a Long tool, if p2 is above p1, it's the target. If below, we flip.
            // For simplicity, we treat p2 as the "outer edge" and p1 as the "entry".
            // We'll calculate a symmetric stop/target for visual representation.
            const diffY = y2 - y1;
            const stopY = y1 - diffY; // Risk is equal to Reward in this simple version

            ctx.save();

            // Target Area (Green)
            ctx.fillStyle = this._type === 'long' ? 'rgba(8, 153, 129, 0.2)' : 'rgba(242, 54, 69, 0.2)';
            if (this._type === 'long') {
                const targetY = Math.min(y1, y2);
                const targetH = Math.abs(y1 - y2);
                ctx.fillRect(startX, targetY, width, targetH);
                
                // Stop Area (Red)
                ctx.fillStyle = 'rgba(242, 54, 69, 0.2)';
                ctx.fillRect(startX, y1, width, Math.abs(y1 - stopY));
            } else {
                const targetY = Math.max(y1, y2);
                const targetH = Math.abs(y1 - y2);
                ctx.fillRect(startX, y1, width, targetH);
                
                // Stop Area (Green)
                ctx.fillStyle = 'rgba(8, 153, 129, 0.2)';
                ctx.fillRect(startX, stopY, width, Math.abs(y1 - stopY));
            }

            // Entry Line
            ctx.strokeStyle = this._color;
            ctx.lineWidth = 2 * scope.verticalPixelRatio;
            ctx.beginPath();
            ctx.moveTo(startX, y1);
            ctx.lineTo(endX, y1);
            ctx.stroke();

            // Labels (R/B Ratio)
            ctx.font = `bold ${12 * scope.verticalPixelRatio}px Inter, sans-serif`;
            ctx.fillStyle = this._color;
            ctx.fillText(`R/B: 1.00`, startX + 5 * scope.horizontalPixelRatio, y1 - 5 * scope.verticalPixelRatio);

            ctx.restore();
        });
    }
}

class PositionView implements ISeriesPrimitivePaneView {
    private _p1: { x: number, y: number } | null = null;
    private _p2: { x: number, y: number } | null = null;

    constructor(private _source: PositionPrimitive) {}

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
        return new PositionRenderer(
            this._p1, this._p2, 
            this._source.type,
            this._source.parameters.color, 
            this._source.parameters.width
        );
    }
}

export class PositionPrimitive implements ISeriesPrimitive {
    private _view = new PositionView(this);
    public chart: IChartApi | null = null;
    public series: ISeriesApi<'Candlestick' | 'Line'> | null = null;

    constructor(
        public type: 'long' | 'short',
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

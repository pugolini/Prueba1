import { ISeriesPrimitive, ISeriesPrimitivePaneView, ISeriesPrimitivePaneRenderer, CanvasRenderingTarget2D, ISeriesApi, IChartApi, Coordinate, Time } from 'lightweight-charts';
import { Point } from './PluginHelpers';

class TrendLineRenderer implements ISeriesPrimitivePaneRenderer {
    constructor(
        private _p1: { x: number, y: number } | null,
        private _p2: { x: number, y: number } | null,
        private _color: string,
        private _width: number,
        private _style: number,
        private _selected: boolean,
        private _text?: string,
        private _textColor?: string
    ) {}

    draw(target: CanvasRenderingTarget2D) {
        if (!this._p1 || !this._p2) return;
        target.useBitmapCoordinateSpace(scope => {
            const ctx = scope.context;
            const x1 = this._p1!.x * scope.horizontalPixelRatio;
            const y1 = this._p1!.y * scope.verticalPixelRatio;
            const x2 = this._p2!.x * scope.horizontalPixelRatio;
            const y2 = this._p2!.y * scope.verticalPixelRatio;

            ctx.save();
            
            // 1. Dibujar la línea
            ctx.beginPath();
            ctx.strokeStyle = this._color;
            ctx.lineWidth = this._width * scope.verticalPixelRatio;
            
            // Estilos de línea
            if (this._style === 1) ctx.setLineDash([2 * scope.horizontalPixelRatio, 2 * scope.horizontalPixelRatio]); // Dotted
            else if (this._style === 2) ctx.setLineDash([5 * scope.horizontalPixelRatio, 5 * scope.horizontalPixelRatio]); // Dashed
            
            ctx.moveTo(x1, y1);
            ctx.lineTo(x2, y2);
            ctx.stroke();

            // 2. Dibujar Handles (Puntos de anclaje) si está seleccionado
            if (this._selected) {
                const radius = 4 * scope.horizontalPixelRatio;
                const centerRadius = 5 * scope.horizontalPixelRatio;
                ctx.setLineDash([]); // Reset dash for handles
                
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

            // 3. Dibujar Texto si existe (Rotado y encima de la línea)
            if (this._text) {
                ctx.setLineDash([]);
                const centerX = (x1 + x2) / 2;
                const centerY = (y1 + y2) / 2;
                
                let angle = Math.atan2(y2 - y1, x2 - x1);
                if (angle > Math.PI / 2 || angle < -Math.PI / 2) angle += Math.PI;

                ctx.save();
                ctx.translate(centerX, centerY);
                ctx.rotate(angle);

                ctx.font = `bold ${11 * scope.verticalPixelRatio}px Inter, sans-serif`;
                ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
                ctx.shadowBlur = 4 * scope.horizontalPixelRatio;
                
                ctx.fillStyle = this._textColor || this._color;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom'; 
                
                const verticalOffset = 4 * scope.verticalPixelRatio;
                ctx.fillText(this._text, 0, -verticalOffset);
                
                ctx.restore();
            }
            
            ctx.restore();
        });
    }
}

class TrendLineView implements ISeriesPrimitivePaneView {
    private _p1: { x: number, y: number } | null = null;
    private _p2: { x: number, y: number } | null = null;

    constructor(private _source: TrendLinePrimitive) {}

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
        return new TrendLineRenderer(
            this._p1, this._p2, 
            this._source.parameters.color, 
            this._source.parameters.width, 
            this._source.parameters.style,
            this._source.selected,
            this._source.parameters.text,
            this._source.parameters.textColor
        );
    }
}

export class TrendlinePrimitive implements ISeriesPrimitive {
    private _view = new TrendLineView(this);
    public chart: IChartApi | null = null;
    public series: ISeriesApi<'Candlestick' | 'Line'> | null = null;
    public selected: boolean = false;

    constructor(
        public points: Point[],
        public parameters: { color: string, width: number, style: number, text?: string, textColor?: string }
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

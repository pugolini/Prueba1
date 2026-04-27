import { ISeriesPrimitive, ISeriesPrimitivePaneView, ISeriesPrimitivePaneRenderer, CanvasRenderingTarget2D, ISeriesApi, IChartApi, Coordinate, Time } from 'lightweight-charts';
import { Point } from './PluginHelpers';

class RectangleRenderer implements ISeriesPrimitivePaneRenderer {
    constructor(
        private _p1: { x: number, y: number } | null,
        private _p2: { x: number, y: number } | null,
        private _color: string,
        private _width: number,
        private _fillColor: string,
        private _fillOpacity: number,
        private _extendRight: boolean,
        private _selected: boolean,
        private _text?: string,
        private _textColor?: string
    ) {}

    draw(target: CanvasRenderingTarget2D) {
        if (!this._p1) return;
        target.useBitmapCoordinateSpace(scope => {
            const ctx = scope.context;
            const x1 = this._p1!.x * scope.horizontalPixelRatio;
            const y1 = this._p1!.y * scope.verticalPixelRatio;
            
            let x2 = this._p2 ? this._p2.x * scope.horizontalPixelRatio : x1;
            const y2 = this._p2 ? this._p2.y * scope.verticalPixelRatio : y1;

            if (this._extendRight) {
                x2 = scope.bitmapSize.width;
            } else if (!this._p2) {
                // Si no hay p2 (punto en el futuro) y no es extendido, 
                // por ahora no dibujamos o lo llevamos al borde para evitar que "desaparezca" al arrastrar
                x2 = scope.bitmapSize.width;
            }

            const x = Math.min(x1, x2);
            const y = Math.min(y1, y2);
            const w = Math.abs(x1 - x2);
            const h = Math.abs(y1 - y2);

            ctx.save();
            ctx.beginPath();
            
            // Fill
            if (this._fillColor && this._fillColor !== 'transparent') {
                ctx.globalAlpha = this._fillOpacity;
                ctx.fillStyle = this._fillColor;
                ctx.fillRect(x, y, w, h);
                ctx.globalAlpha = 1.0; // Reset for stroke
            }

            // Stroke
            if (this._width > 0) {
                ctx.strokeStyle = this._color;
                ctx.lineWidth = this._width * scope.verticalPixelRatio;
                ctx.strokeRect(x, y, w, h);
            }

            // Text Label (CENTERED)
            if (this._text) {
                const centerX = x + w / 2;
                const centerY = y + h / 2;

                ctx.font = `bold ${11 * scope.verticalPixelRatio}px Inter, sans-serif`;
                const textWidth = ctx.measureText(this._text).width;
                const textHeight = 14 * scope.verticalPixelRatio;

                // Background
                ctx.fillStyle = 'rgba(30, 34, 45, 0.6)';
                ctx.fillRect(
                    centerX - textWidth / 2 - 4 * scope.horizontalPixelRatio,
                    centerY - textHeight / 2,
                    textWidth + 8 * scope.horizontalPixelRatio,
                    textHeight
                );

                ctx.fillStyle = this._textColor || this._color;
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(this._text, centerX, centerY);
            }

            // Handles (Corners + Center)
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
                drawHandle(x2, y1);
                drawHandle(x1, y2);
                drawHandle(x2, y2);
                drawHandle(x + w / 2, y + h / 2, true); // Center handle
            }
            
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
            this._source.parameters.fillColor || 'rgba(41, 98, 255, 0.1)',
            this._source.parameters.fillOpacity ?? 0.1,
            this._source.parameters.extendRight ?? false,
            this._source.selected,
            this._source.parameters.text,
            this._source.parameters.textColor
        );
    }
}

export class RectanglePrimitive implements ISeriesPrimitive {
    private _view = new RectangleView(this);
    public chart: IChartApi | null = null;
    public series: ISeriesApi<'Candlestick' | 'Line'> | null = null;
    public selected: boolean = false;

    constructor(
        public points: Point[],
        public parameters: { 
            color: string, 
            width: number, 
            fillColor?: string, 
            fillOpacity?: number,
            extendRight?: boolean,
            text?: string, 
            textColor?: string 
        }
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

import {
    ISeriesPrimitive,
    SeriesPrimitivePaneView,
    SeriesPrimitivePaneRenderer,
    CanvasRenderingTarget2D,
    IChartApi,
    ISeriesApi,
} from 'lightweight-charts';

/**
 * RENDERER NATIVO (Solid Design V5)
 */
class DiamondRenderer implements SeriesPrimitivePaneRenderer {
    private _points: { x: number; y: number; color: string; isStacked: boolean }[] = [];

    constructor(points: { x: number; y: number; color: string; isStacked: boolean }[]) {
        this._points = points;
    }

    draw(target: CanvasRenderingTarget2D): void {
        target.useBitmapCoordinateSpace((scope) => {
            const ctx = scope.context;
            this._points.forEach((p) => {
                const baseSize = p.isStacked ? 8 : 6;
                const sizeX = baseSize * scope.horizontalPixelRatio;
                const sizeY = baseSize * scope.verticalPixelRatio;
                
                const x = p.x * scope.horizontalPixelRatio;
                const y = p.y * scope.verticalPixelRatio;

                ctx.beginPath();
                ctx.fillStyle = p.color;
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
                ctx.lineWidth = p.isStacked ? 2 : 1;
                
                ctx.moveTo(x, y - sizeY);
                ctx.lineTo(x + sizeX, y);
                ctx.lineTo(x, y + sizeY);
                ctx.lineTo(x - sizeX, y);
                ctx.closePath();
                
                ctx.fill();
                ctx.stroke();

                if (p.isStacked) {
                    ctx.fillStyle = '#ffffff';
                    ctx.beginPath();
                    ctx.arc(x, y, 2 * scope.horizontalPixelRatio, 0, Math.PI * 2);
                    ctx.fill();
                }
            });
        });
    }
}

class DiamondPaneView implements SeriesPrimitivePaneView {
    private _points: { x: number; y: number; color: string; isStacked: boolean }[] = [];

    constructor(points: { x: number; y: number; color: string; isStacked: boolean }[]) {
        this._points = points;
    }

    renderer(): SeriesPrimitivePaneRenderer | null {
        return new DiamondRenderer(this._points);
    }
}

export class DiamondPrimitive implements ISeriesPrimitive {
    private _signals: Record<number, any> = {};
    private _chart: IChartApi | null = null;
    private _series: ISeriesApi<"Candlestick"> | null = null;
    private _lastDataCount: number = 0;

    constructor() {}

    public setSignals(signals: Record<number, any>) {
        this._signals = signals;
        this.requestUpdate();
    }

    attached({ chart, series }: { chart: IChartApi, series: ISeriesApi<"Candlestick"> }): void {
        this._chart = chart;
        this._series = series;
    }

    detached(): void {
        this._chart = null;
        this._series = null;
    }

    paneViews(): readonly SeriesPrimitivePaneView[] {
        if (!this._chart || !this._series || Object.keys(this._signals).length === 0) {
            return [];
        }

        const timeScale = this._chart.timeScale();
        const data = this._series.data();
        
        // Si no hay data aún, no podemos posicionar diamantes
        if (data.length === 0) return [];

        const points: { x: number; y: number; color: string; isStacked: boolean }[] = [];

        Object.entries(this._signals).forEach(([tStr, signal]: [string, any]) => {
            const time = parseInt(tStr);
            const x = timeScale.timeToCoordinate(time as any);
            
            if (x === null) return;

            // Búsqueda optimizada: Los datos suelen estar ordenados por tiempo
            // Buscamos la vela correspondiente
            const bar = data.find((d: any) => (d.time as number) === time);
            if (!bar) return;

            const price = signal.type === 'buy_trap' ? bar.high : bar.low;
            const y = this._series!.priceToCoordinate(price);
            
            if (y !== null) {
                points.push({
                    x: x,
                    y: y,
                    color: signal.type === 'buy_trap' ? '#f23645' : '#089981',
                    isStacked: signal.isStacked
                });
            }
        });

        return [new DiamondPaneView(points)];
    }

    updateAllViews() {
        // El motor de LW Charts llamará a paneViews() automáticamente cuando necesite redibujar.
    }

    private requestUpdate() {
        if (this._series) {
            // Forzar al gráfico a pedir nuevas paneViews
            this._series.applyOptions({}); 
        }
    }
}

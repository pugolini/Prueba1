import { 
    ISeriesPrimitive, 
    ISeriesPrimitivePaneView, 
    ISeriesPrimitivePaneRenderer, 
    CanvasRenderingTarget2D, 
    ISeriesApi, 
    IChartApi, 
    Coordinate, 
    Time 
} from 'lightweight-charts';

export interface HistogramItem {
    price: number;
    volume: number;
}

export interface AnchoredProfileOptions {
    label: string;
    dynamicAnchor: boolean;
    vaColor: string;      // Color para el Value Area
    nonVaColor: string;   // Color para fuera del Value Area
    pocColor: string;
    vahValColor: string;
    opacity: number;
}

interface BarData {
    y: number;
    width: number;
    height: number;
    inVA: boolean;
}

class AnchoredProfileRenderer implements ISeriesPrimitivePaneRenderer {
    constructor(
        private _bars: BarData[],
        private _startX: number | null,
        private _endX: number | null,
        private _pocY: number | null,
        private _vahY: number | null,
        private _valY: number | null,
        private _options: AnchoredProfileOptions
    ) {}

    draw(target: CanvasRenderingTarget2D) {
        if (this._startX === null) return;

        target.useBitmapCoordinateSpace(scope => {
            const ctx = scope.context;
            const horizontalPixelRatio = scope.horizontalPixelRatio;
            const verticalPixelRatio = scope.verticalPixelRatio;

            const startX = this._startX! * horizontalPixelRatio;
            const endX = (this._endX !== null ? this._endX : scope.bitmapSize.width / horizontalPixelRatio) * horizontalPixelRatio;
            // 🚀 COMPACTACIÓN NIVEL DEEPCHART: 15% del ancho de sesión
            const maxWidth = Math.abs(endX - startX) * 0.15;

            ctx.save();

            // 1. Dibujar Histograma con Textura de "Beaning" (Estilo Deepchart)
            if (this._bars.length === 0) return;

            const drawProfileLines = (bars: BarData[], color: string, alpha: number) => {
                if (bars.length === 0) return;
                
                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.strokeStyle = color;
                ctx.lineWidth = 1;

                const pocYPhysical = this._pocY !== null ? Math.round(this._pocY * verticalPixelRatio) : null;

                for (let i = 0; i < bars.length; i++) {
                    const bar = bars[i];
                    const yTop = Math.round(bar.y * verticalPixelRatio - (bar.height * verticalPixelRatio) / 2);
                    const yBottom = Math.round(bar.y * verticalPixelRatio + (bar.height * verticalPixelRatio) / 2);
                    
                    const wStart = (bar.width / 1000) * maxWidth;
                    const nextBar = bars[i + 1];
                    const wEnd = nextBar ? (nextBar.width / 1000) * maxWidth : wStart;

                    for (let py = yTop; py <= yBottom; py += 3) {
                        const progress = (py - yTop) / (yBottom - yTop || 1);
                        const currentW = wStart + (wEnd - wStart) * progress;
                        
                        ctx.beginPath();
                        
                        // 🚀 RESALTADO POC: Si esta línea coincide con el POC, usamos morado intenso
                        if (pocYPhysical !== null && Math.abs(py - pocYPhysical) <= 1) {
                            ctx.save();
                            ctx.globalAlpha = 0.9;
                            ctx.strokeStyle = '#9C27B0'; // Morado institucional
                            ctx.lineWidth = 2 * verticalPixelRatio;
                            ctx.moveTo(startX, py);
                            ctx.lineTo(startX + currentW, py);
                            ctx.stroke();
                            ctx.restore();
                        } else {
                            ctx.moveTo(startX, py);
                            ctx.lineTo(startX + currentW, py);
                            ctx.stroke();
                        }
                    }
                }
                ctx.restore();
            };

            const vaBars = this._bars.filter(b => b.inVA);

            // Ajuste de colores y opacidad para nitidez industrial
            drawProfileLines(this._bars.filter(b => !b.inVA), '#D1D1D1', 0.2); 
            drawProfileLines(vaBars, '#1A1A1A', 0.25);    

            // 2. Silueta Exterior Blanca (ELIMINADA)

            // 3. Líneas de Referencia y Etiquetas (Alineación Derecha)
            const drawReferenceLine = (yVal: number | null, color: string, type: string, isPoc: boolean = false) => {
                if (yVal === null) return;
                const y = Math.round(yVal * verticalPixelRatio);

                ctx.beginPath();
                if (!isPoc) {
                    ctx.setLineDash([3 * horizontalPixelRatio, 3 * horizontalPixelRatio]);
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                } else {
                    ctx.setLineDash([5 * horizontalPixelRatio, 5 * horizontalPixelRatio]);
                    ctx.strokeStyle = '#9C27B0'; // POC Morado coincidente con el perfil
                }
                
                ctx.lineWidth = (isPoc ? 1.5 : 0.8) * verticalPixelRatio;
                const lineEnd = startX + maxWidth + 15 * horizontalPixelRatio;
                
                ctx.moveTo(startX, y);
                ctx.lineTo(lineEnd, y);
                ctx.stroke();

                ctx.setLineDash([]);
                ctx.fillStyle = isPoc ? '#9C27B0' : '#FFFFFF';
                ctx.font = `${isPoc ? 'bold' : 'normal'} ${Math.round(9 * verticalPixelRatio)}px Inter, Arial`;
                
                const labelX = lineEnd + 5 * horizontalPixelRatio;
                ctx.fillText(`${this._options.label} ${type}`, labelX, y + 3 * verticalPixelRatio);
            };

            drawReferenceLine(this._vahY, '#FFFFFF', 'VAH');
            drawReferenceLine(this._pocY, '#9C27B0', 'POC', true);
            drawReferenceLine(this._valY, '#FFFFFF', 'VAL');

            ctx.restore();
        });
    }
}

class AnchoredProfileView implements ISeriesPrimitivePaneView {
    private _bars: BarData[] = [];
    private _startX: number | null = null;
    private _endX: number | null = null;
    private _pocY: number | null = null;
    private _vahY: number | null = null;
    private _valY: number | null = null;

    constructor(private _source: AnchoredProfilePrimitive) {}

    update() {
        const { chart, series, startTime, endTime, histogram, poc, vah, val, options } = this._source;
        if (!chart || !series || histogram.length === 0) return;

        const timeScale = chart.timeScale();
        let startX = timeScale.timeToCoordinate(startTime as Time);
        let endX = endTime ? timeScale.timeToCoordinate(endTime as Time) : null;
        
        // Manejo de anclaje dinámico
        if (options.dynamicAnchor) {
            if (startX === null || startX < 0) {
                startX = 0 as Coordinate;
            }
        }
        
        this._startX = startX;
        this._endX = endX;

        const maxVol = Math.max(...histogram.map(h => h.volume));
        const totalWidth = 1000;
        
        this._bars = histogram.map((item, i) => {
            const y = series.priceToCoordinate(item.price);
            if (y === null) return null;

            let height = 2;
            if (i < histogram.length - 1) {
                const nextY = series.priceToCoordinate(histogram[i + 1].price);
                if (nextY !== null) height = Math.max(Math.abs(nextY - y), 2);
            }

            return {
                y,
                width: (item.volume / maxVol) * 1000,
                height,
                inVA: item.price <= vah && item.price >= val
            };
        }).filter(b => b !== null) as BarData[];

        this._pocY = series.priceToCoordinate(poc);
        this._vahY = series.priceToCoordinate(vah);
        this._valY = series.priceToCoordinate(val);
    }


    renderer() {
        return new AnchoredProfileRenderer(
            this._bars,
            this._startX,
            this._endX,
            this._pocY,
            this._vahY,
            this._valY,
            this._source.options
        );
    }
}

export class AnchoredProfilePrimitive implements ISeriesPrimitive {
    private _view = new AnchoredProfileView(this);
    public chart: IChartApi | null = null;
    public series: ISeriesApi<'Candlestick' | 'Line'> | null = null;

    constructor(
        public histogram: HistogramItem[],
        public startTime: number,
        public endTime: number | null,
        public poc: number,
        public vah: number,
        public val: number,
        public options: AnchoredProfileOptions
    ) {}

    attached({ chart, series }: { chart: IChartApi, series: ISeriesApi<'Candlestick' | 'Line'> }) {
        this.chart = chart;
        this.series = series;
        this.updateAllViews();
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

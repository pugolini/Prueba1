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
    widthFactor: number;
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
            const chartWidth = scope.bitmapSize.width;
            const maxWidth = chartWidth * this._options.widthFactor;

            ctx.save();

            // 1. Dibujar Histograma (Líneas de Alta Densidad Píxel a Píxel)

            if (this._bars.length === 0) return;

            // Encontramos el rango vertical total
            const minY = Math.round(this._bars[0].y * verticalPixelRatio - (this._bars[0].height * verticalPixelRatio) / 2);
            const maxY = Math.round(this._bars[this._bars.length - 1].y * verticalPixelRatio + (this._bars[this._bars.length - 1].height * verticalPixelRatio) / 2);

            // Función para dibujar masa densa de líneas
            const drawDenseLines = (bars: BarData[], color: string, alpha: number) => {
                if (bars.length === 0) return;
                
                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.beginPath();
                ctx.strokeStyle = color;
                ctx.lineWidth = 1; // 1 píxel físico

                for (const bar of bars) {
                    const yTop = Math.round(bar.y * verticalPixelRatio - (bar.height * verticalPixelRatio) / 2);
                    const yBottom = Math.round(bar.y * verticalPixelRatio + (bar.height * verticalPixelRatio) / 2);
                    const w = (bar.width / 1000) * maxWidth;

                    // Dibujamos líneas para cada píxel de altura de este bin
                    for (let py = yTop; py <= yBottom; py++) {
                        ctx.moveTo(startX, py);
                        ctx.lineTo(startX + w, py);
                    }
                }
                ctx.stroke();
                ctx.restore();
            };

            const vaBars = this._bars.filter(b => b.inVA);
            const nonVaBars = this._bars.filter(b => !b.inVA);

            // Dibujamos con el esquema de colores institucional
            drawDenseLines(nonVaBars, '#E5E4E2', 0.3); // Exterior traslúcido
            drawDenseLines(vaBars, '#2A2A2A', 0.6);   // VA Carbón

            // 2. Silueta Exterior Blanca (ELIMINADA PARA EVITAR BORDES ARTIFICIALES)
            // El perfil se define exclusivamente por la densidad de sus líneas horizontales.

            // 3. Líneas de Referencia y Etiquetas (Alineación Derecha)
            const drawReferenceLine = (yVal: number | null, color: string, type: string, isPoc: boolean = false) => {
                if (yVal === null) return;
                const y = Math.round(yVal * verticalPixelRatio);

                ctx.beginPath();
                if (!isPoc) {
                    ctx.setLineDash([3 * horizontalPixelRatio, 3 * horizontalPixelRatio]);
                    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                } else {
                    ctx.setLineDash([]);
                    ctx.strokeStyle = '#1A1A1A'; // POC Gris muy oscuro
                }
                
                ctx.lineWidth = (isPoc ? 1.5 : 0.8) * verticalPixelRatio;
                const lineEnd = startX + maxWidth + 15 * horizontalPixelRatio;
                
                ctx.moveTo(startX, y);
                ctx.lineTo(lineEnd, y);
                ctx.stroke();

                ctx.setLineDash([]);
                ctx.fillStyle = isPoc ? '#1A1A1A' : '#FFFFFF';
                ctx.font = `${isPoc ? 'bold' : 'normal'} ${Math.round(9 * verticalPixelRatio)}px Inter, Arial`;
                
                const labelX = lineEnd + 5 * horizontalPixelRatio;
                ctx.fillText(`${this._options.label} ${type}`, labelX, y + 3 * verticalPixelRatio);
            };

            drawReferenceLine(this._vahY, '#FFFFFF', 'VAH');
            drawReferenceLine(this._pocY, '#1A1A1A', 'POC', true);
            drawReferenceLine(this._valY, '#FFFFFF', 'VAL');

            ctx.restore();
        });
    }
}

class AnchoredProfileView implements ISeriesPrimitivePaneView {
    private _bars: BarData[] = [];
    private _startX: number | null = null;
    private _pocY: number | null = null;
    private _vahY: number | null = null;
    private _valY: number | null = null;

    constructor(private _source: AnchoredProfilePrimitive) {}

    update() {
        const { chart, series, startTime, histogram, poc, vah, val, options } = this._source;
        if (!chart || !series || histogram.length === 0) return;

        const timeScale = chart.timeScale();
        let startX = timeScale.timeToCoordinate(startTime as Time);
        
        // Manejo de anclaje dinámico
        if (options.dynamicAnchor) {
            if (startX === null || startX < 0) {
                startX = 0 as Coordinate;
            }
        } else {
            // Si no es dinámico y está fuera a la izquierda, lightweight-charts suele devolver null o valores negativos grandes.
            // lo dejamos tal cual para que se desplace con el gráfico.
        }
        
        this._startX = startX;

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

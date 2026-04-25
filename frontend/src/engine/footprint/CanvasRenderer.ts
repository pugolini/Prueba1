import { CandleData } from './StorageManager';

interface RenderOptions {
  width: number;
  height: number;
  tickSize: number;
  visibleCandles: number;
  zoomX: number;
  offsetY: number;
}

export class CanvasRenderer {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private isRendering = false;
  
  private candles: CandleData[] = [];
  private options: RenderOptions = {
    width: 800,
    height: 600,
    tickSize: 0.25,
    visibleCandles: 50,
    zoomX: 1,
    offsetY: 0
  };

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    const ctx = canvas.getContext('2d', { alpha: false });
    if (!ctx) throw new Error("Could not initialize 2D context");
    this.ctx = ctx;
  }

  public updateDimensions(width: number, height: number) {
    this.canvas.width = width * window.devicePixelRatio;
    this.canvas.height = height * window.devicePixelRatio;
    this.options.width = width * window.devicePixelRatio;
    this.options.height = height * window.devicePixelRatio;
    this.ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    this.requestFrame();
  }

  public setData(history: CandleData[], liveCandle: CandleData | null) {
    this.candles = [...history];
    if (liveCandle) {
       const last = this.candles[this.candles.length - 1];
       if (last && last.timestamp === liveCandle.timestamp) {
         this.candles[this.candles.length - 1] = liveCandle;
       } else {
         this.candles.push(liveCandle);
       }
    }
    this.requestFrame();
  }

  public setOptions(opts: Partial<RenderOptions>) {
    this.options = { ...this.options, ...opts };
    this.requestFrame();
  }

  private requestFrame() {
    if (!this.isRendering) {
      this.isRendering = true;
      requestAnimationFrame(() => this.draw());
    }
  }

  private draw() {
    this.isRendering = false;
    
    // Virtual resolution vs logical 
    const logicalWidth = this.options.width / window.devicePixelRatio;
    const logicalHeight = this.options.height / window.devicePixelRatio;

    this.ctx.fillStyle = '#0F172A';
    this.ctx.fillRect(0, 0, logicalWidth, logicalHeight);

    if (this.candles.length === 0) {
        this.ctx.fillStyle = '#64748B';
        this.ctx.font = '14px Inter, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText('CONECTADO - ESPERANDO FLUJO DE DATOS...', logicalWidth / 2, logicalHeight / 2);
        return;
    }

    const baseCandleWidth = 20;
    const candleWidth = baseCandleWidth * this.options.zoomX;
    const marginRatio = 0.2;
    const candleBodyWidth = candleWidth * (1 - marginRatio);
    const spaceWidth = candleWidth * marginRatio;

    const startIndex = Math.max(0, this.candles.length - this.options.visibleCandles);
    const visibleDataset = this.candles.slice(startIndex);
    
    let globalHigh = -Infinity;
    let globalLow = Infinity;
    
    // Solo usamos las últimas velas para determinar la escala si hay una discrepancia masiva
    // para evitar que el gráfico se "aplaste" por datos basura.
    const scalingDataset = visibleDataset.slice(-30); 
    for(const c of scalingDataset) {
        if (c.high > globalHigh) globalHigh = c.high;
        if (c.low < globalLow) globalLow = c.low;
    }

    // Fallback al dataset completo si el recorte es muy pequeño
    if (globalHigh === -Infinity) {
        for(const c of visibleDataset) {
            if (c.high > globalHigh) globalHigh = c.high;
            if (c.low < globalLow) globalLow = c.low;
        }
    }

    const paddingBottom = 50;
    const paddingTop = 40;
    const chartHeight = logicalHeight - paddingBottom - paddingTop;
    
    // 1. Calcular el rango de precios con un margen de seguridad
    const priceMargin = this.options.tickSize * 5;
    const effectiveHigh = globalHigh + priceMargin;
    const effectiveLow = globalLow - priceMargin;
    const priceRange = effectiveHigh - effectiveLow;
    
    // 2. Determinar píxeles por tick con mayor estabilidad
    const totalTicksInRange = priceRange / this.options.tickSize || 10;
    let pixelsPerTick = chartHeight / totalTicksInRange;
    
    // Zoom vertical controlado
    pixelsPerTick = Math.max(2, Math.min(60, pixelsPerTick));

    const getY = (price: number) => {
      // Centrar el gráfico verticalmente si no hay offset
      const middleY = logicalHeight / 2;
      const middlePrice = (effectiveHigh + effectiveLow) / 2;
      const priceDiff = (middlePrice - price) / this.options.tickSize;
      return middleY + (priceDiff * pixelsPerTick) + (this.options.offsetY || 0);
    };

    // 3. Posicionamiento horizontal: De derecha a izquierda
    // La vela más reciente (Dataset[last]) debe estar a una distancia fija del borde derecho
    const paddingRight = 100;
    const getX = (indexInVisible: number) => {
        return logicalWidth - paddingRight - ((visibleDataset.length - 1 - indexInVisible) * candleWidth);
    };

    const startX = logicalWidth - (visibleDataset.length * candleWidth);
    
    this.ctx.textAlign = 'center';
    this.ctx.textBaseline = 'middle';

    for (let i = 0; i < visibleDataset.length; i++) {
        const candle = visibleDataset[i];
        const cx = getX(i);
        const centerX = cx + (candleWidth / 2);
        
        const isBullish = candle.close >= candle.open;
        const color = isBullish ? '#10B981' : '#EF4444';
        const wickColor = isBullish ? '#34D399' : '#F87171'; // 🟢 Mechas vinculadas al color de la vela pero más brillantes
        
        const yOpen = getY(candle.open);
        const yClose = getY(candle.close);
        const yHigh = getY(candle.high);
        const yLow = getY(candle.low);
        
        const topWickEnd = Math.min(yOpen, yClose);
        const bottomWickStart = Math.max(yOpen, yClose);
        const bodyHeight = Math.abs(yOpen - yClose) || 2; // Mínimo 2px para que se vea

        // DIBUJAR MECHAS (WICKS)
        this.ctx.strokeStyle = wickColor;
        this.ctx.lineWidth = 1.2;
        this.ctx.beginPath();
        // Mecha superior
        this.ctx.moveTo(centerX, yHigh);
        this.ctx.lineTo(centerX, topWickEnd);
        // Mecha inferior
        this.ctx.moveTo(centerX, yLow);
        this.ctx.lineTo(centerX, bottomWickStart);
        this.ctx.stroke();

        this.ctx.fillStyle = color;
        const rectY = Math.min(yOpen, yClose);
        this.ctx.fillRect(Math.floor(cx + spaceWidth/2), Math.floor(rectY), Math.floor(candleBodyWidth), Math.floor(bodyHeight));

        // 4. Dibujo de Delta (Simplificado y Premium)
        // Posicionamiento: Siempre debajo de la mecha inferior
        const isPosDelta = candle.totalDelta >= 0;
        const deltaStr = (isPosDelta ? '+' : '') + candle.totalDelta.toLocaleString();
        
        this.ctx.font = 'bold 11px Inter, sans-serif';
        this.ctx.fillStyle = isPosDelta ? '#34D399' : '#F87171';
        
        // Dibujamos el texto debajo de yLow con un pequeño margen
        const deltaY = yLow + 15;
        this.ctx.fillText(deltaStr, centerX, deltaY);

        // Opcional: Una pequeña barra de intensidad de volumen (subtil)
        const maxBarWidth = candleWidth * 0.8;
        const volRatio = Math.min(candle.totalVolume / 5000, 1);
        this.ctx.fillStyle = 'rgba(148, 163, 184, 0.2)';
        this.ctx.fillRect(centerX - maxBarWidth/2, deltaY + 8, maxBarWidth * volRatio, 2);
    }
}
}

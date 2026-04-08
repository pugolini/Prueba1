import { ISeriesApi, IChartApi, Coordinate, Time } from 'lightweight-charts';

export interface Point {
    time: number;
    price: number;
}

export function getPixelCoords(
    chart: IChartApi,
    series: ISeriesApi<'Candlestick' | 'Line'>,
    point: Point
): { x: number | null, y: number | null } {
    const timeScale = chart.timeScale();
    const x = timeScale.timeToCoordinate(point.time as Time);
    const y = series.priceToCoordinate(point.price);
    return { x, y };
}

export function drawLine(
    ctx: CanvasRenderingContext2D,
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    color: string,
    width: number,
    style: number = 0 // 0: Solid, 1: Dotted, 2: Dashed
) {
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    
    if (style === 1) ctx.setLineDash([2, 4]);
    else if (style === 2) ctx.setLineDash([10, 5]);
    
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.restore();
}

export function drawRect(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    w: number,
    h: number,
    color: string,
    width: number,
    fillColor?: string
) {
    ctx.save();
    ctx.beginPath();
    if (fillColor) {
        ctx.fillStyle = fillColor;
        ctx.fillRect(x, y, w, h);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.strokeRect(x, y, w, h);
    ctx.restore();
}

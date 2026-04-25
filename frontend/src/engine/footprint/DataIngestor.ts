import { Tick, StorageManager } from './StorageManager';

export class DataIngestor {
  private ws: WebSocket | null = null;
  private url: string;
  private symbol: string;
  private isConnected: boolean = false;
  
  public onTickReceived?: (tick: Tick) => void;
  public onConnectionChange?: (connected: boolean) => void;

  constructor(symbol: string) {
    this.symbol = symbol;
    const baseUrl = import.meta.env.VITE_RITHMIC_WS_URL || 'ws://127.0.0.1:8000/ws/orderflow';
    this.url = `${baseUrl}/${symbol}`;
  }

  public connect() {
    if (this.ws && (this.ws.readyState === WebSocket.CONNECTING || this.ws.readyState === WebSocket.OPEN)) return;

    try {
      this.ws = new WebSocket(this.url);

      this.ws.onopen = () => {
        this.isConnected = true;
        this.onConnectionChange?.(true);
        // La suscripción se hace vía URL en este servidor, pero enviamos el JSON por si acaso
        this.subscribe();
      };

      this.ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          
          if (message.type === 'tick_burst') {
            const rawTicks = message.data || [];
            rawTicks.forEach((t: any) => {
                const tick: Tick = {
                    timestamp: t.time || Date.now(),
                    symbol: this.symbol,
                    price: t.price,
                    volume: t.volume || 1,
                    type: t.side === 'buy' ? 'ask' : (t.side === 'sell' ? 'bid' : (t.price >= t.ask ? 'ask' : 'bid'))
                };
                this.onTickReceived?.(tick);
                this.bufferTickForStorage(tick);
            });
          } else if (message.type === 'price_update' || message.type === 'heartbeat') {
            const tick: Tick = {
                timestamp: message.time || Date.now(),
                symbol: this.symbol,
                price: message.price,
                volume: 1,
                type: message.price >= (message.ask || message.price) ? 'ask' : 'bid'
            };
            this.onTickReceived?.(tick);
            this.bufferTickForStorage(tick);
          }
        } catch (e) {
          console.error("Error parsing WS message:", e);
        }
      };

      this.ws.onclose = () => {
        this.isConnected = false;
        this.onConnectionChange?.(false);
        setTimeout(() => this.connect(), 3000);
      };
    } catch (e) {
      console.error("[DataIngestor] WebSocket Init Failed:", e);
    }
  }

  private subscribe() {
    if (this.ws && this.isConnected) {
      this.ws.send(JSON.stringify({ action: 'subscribe', symbol: this.symbol }));
    }
  }

  public disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }

  private tickBuffer: Tick[] = [];
  private bufferTimer: ReturnType<typeof setTimeout> | null = null;

  private bufferTickForStorage(tick: Tick) {
    this.tickBuffer.push(tick);
    if (this.tickBuffer.length >= 200) {
      this.flushTickBuffer();
    } else if (!this.bufferTimer) {
      this.bufferTimer = setTimeout(() => this.flushTickBuffer(), 1000);
    }
  }

  private flushTickBuffer() {
    if (this.bufferTimer) {
      clearTimeout(this.bufferTimer);
      this.bufferTimer = null;
    }
    if (this.tickBuffer.length > 0) {
      const batch = [...this.tickBuffer];
      this.tickBuffer = [];
      StorageManager.saveTicks(batch).catch(e => console.error("Error saving ticks", e));
    }
  }
}

import { BigTrade } from '../../store/useStore';

export interface AbsorptionZone {
    price: number;
    side: 'buy' | 'sell';
    startTime: number;
    totalVolume: number;
    delta: number;
    isMitigated: boolean;
}

export interface OrderFlowSetup {
    type: string;
    description: string;
    side: 'long' | 'short';
    confidence: number;
    timestamp: number;
    price: number;
}

export interface MacroLevels {
    pdh?: number; // Previous Day High
    pdl?: number; // Previous Day Low
    pdc?: number; // Previous Day Close
    orh?: number; // Overnight High
    orl?: number; // Overnight Low
    ibh?: number; // Initial Balance High (1st Hour)
    ibl?: number; // Initial Balance Low (1st Hour)
}

/**
 * Motor de análisis de Order Flow basado en el curso del Mentor.
 * Detecta Absorción + Agresión (Adrianus Playbook).
 */
export class OrderFlowAnalyzer {
    private absorptionZones: Map<string, AbsorptionZone> = new Map();
    private lastVwap: number | null = null;
    private tickSize: number = 0.25;
    private macroLevels: MacroLevels = {};
    private sessionStartTime: number | null = null;
    private ibFixed: boolean = false;

    private avgVolume: number = 0;
    private candleCount: number = 0;

    // Métricas para Z-Score Adaptativo (EMA)
    private emaVolume: number = 0;
    private emaVariance: number = 0;
    private readonly smoothingFactor: number = 0.05; // ~40 periodos
    private readonly zScoreMultiplier: number = 1.5; // Ajustado a 1.5 para entorno Demo/Simulado
    private readonly minVolumeThreshold: number = 50; 
    
    // Estados para Secuencialidad
    private lastSignalType: 'buy_trap' | 'sell_trap' | null = null;
    private lastSignalTime: number = 0;
    private readonly sequentialWindow: number = 5; // Velas de ventana
    constructor(tickSize: number = 0.25) {
        this.tickSize = tickSize;
    }

    /**
     * Resetea las métricas acumuladas para adaptarse a un nuevo activo (ej. cambio NQ -> ES)
     */
    public reset(newTickSize: number) {
        this.tickSize = newTickSize;
        this.emaVolume = 50; 
        this.emaVariance = 400;
        this.absorptionZones.clear();
        this.lastSignalType = null;
        this.lastSignalTime = 0;
        console.debug(`[OrderFlow] Motor inicializado para ${newTickSize}`);
    }

    /**
     * Calcula métricas para una vela de footprint y detecta traps.
     */
    public analyzeFootprintCandle(candle: any, footprint: Record<number, { bid: number, ask: number }>): { type: 'buy_trap' | 'sell_trap', isStacked: boolean } | null {
        let delta = 0;
        let totalVol = 0;
        let maxVol = 0;
        let pocPrice = 0;

        Object.entries(footprint).forEach(([p, v]) => {
            const vol = (v.bid||0) + (v.ask||0);
            delta += ((v.ask||0) - (v.bid||0));
            totalVol += vol;
            if (vol >= maxVol) {
                maxVol = vol;
                pocPrice = parseFloat(p);
            }
        });

        // REGLA DE ORO PUGOBOT: Si el volumen del footprint es menor al de la vela (datos históricos),
        // usamos el de la vela para que el filtro de "Esfuerzo" (High Effort) no falle.
        const volumeToUse = Math.max(candle.tick_volume || candle.volume || 0, totalVol);
        const candleWithVol = { ...candle, volume: volumeToUse };
        
        // Si el pocPrice es NaN (ej. clave "poc"), lo pasamos como undefined para saltar el filtro de ubicación
        return this.detectCandleAbsorption(candleWithVol, delta, isNaN(pocPrice) ? undefined : pocPrice);
    }

    /**
     * Analiza trades recientes para detectar absorciones.
     * Basado en "Mucho esfuerzo sin resultado".
     */
    public analyzeBigTrades(trades: BigTrade[], currentPrice: number): AbsorptionZone[] {
        const now = Date.now() / 1000;
        
        // Un solo paso para agrupar y filtrar (O(n))
        for (const t of trades) {
            if (now - t.time > 300) continue; // Ignorar trades antiguos

            const pKey = t.price.toFixed(2);
            const totalVol = t.size;
            const delta = t.side === 'buy' ? t.size : -t.size;

            // 1. Actualizar métricas dinámicas
            this.updateVolumeStats(totalVol);

            // 2. Calcular umbral dinámico (Z-Score)
            // StdDev = sqrt(Variance)
            const stdDev = Math.sqrt(this.emaVariance);
            const dynamicThreshold = Math.max(
                this.minVolumeThreshold, 
                this.emaVolume + (this.zScoreMultiplier * stdDev)
            );

            if (totalVol > dynamicThreshold * 0.8) {
                console.debug(`[OrderFlow] BigTrade Detectado? Vol: ${totalVol.toFixed(0)} | Threshold: ${dynamicThreshold.toFixed(0)} | EMA: ${this.emaVolume.toFixed(0)}`);
            }

            // 3. Detección de Absorción Instantánea usando el umbral adaptativo
            if (totalVol > dynamicThreshold) {
                const side = delta > 0 ? 'buy' : 'sell';
                const isTrapped = (side === 'buy' && currentPrice < t.price) || (side === 'sell' && currentPrice > t.price);

                if (isTrapped) {
                    const existing = this.absorptionZones.get(pKey);
                    if (!existing || existing.isMitigated) {
                        this.absorptionZones.set(pKey, {
                            price: t.price,
                            side,
                            startTime: now,
                            totalVolume: totalVol,
                            delta,
                            isMitigated: false
                        });
                    } else {
                        existing.totalVolume += totalVol;
                        existing.delta += delta;
                    }
                }
            }
        }

        this.cleanupZones(now);
        this.mitigateZones(currentPrice);

        return Array.from(this.absorptionZones.values()).filter(z => !z.isMitigated);
    }

    /**
     * Purga zonas antiguas para evitar fugas de memoria (> 2 horas)
     */
    private cleanupZones(now: number) {
        const MAX_AGE = 7200; // 2 horas
        const filteredEntries = Array.from(this.absorptionZones.entries())
            .filter(([_, z]) => (now - z.startTime) < MAX_AGE || !z.isMitigated);
        this.absorptionZones = new Map(filteredEntries);
    }

    private mitigateZones(currentPrice: number) {
        this.absorptionZones.forEach(z => {
            if (!z.isMitigated) {
                const diff = currentPrice - z.price;
                // Mitigación: El precio atraviesa la zona con claridad (4 ticks)
                if ((z.side === 'buy' && diff > this.tickSize * 4) || (z.side === 'sell' && diff < -this.tickSize * 4)) {
                    z.isMitigated = true;
                }
            }
        });
    }

    /**
     * Detecta modelos de entrada específicos
     */
    public detectSetups(currentPrice: number, vwap: number, val: number, vah: number): OrderFlowSetup | null {
        const activeZones = Array.from(this.absorptionZones.values()).filter(z => !z.isMitigated);
        if (activeZones.length === 0) return null;

        const now = Date.now();

        // 1. VWAP Reject / Reclaim (Validado con Absorción)
        const vwapZone = activeZones.find(z => Math.abs(z.price - vwap) < this.tickSize * 2);
        if (vwapZone) {
            // Un Reject necesita que la absorción sea contra el movimiento
            // Ej: Reject alcista -> Absorción de Vendedores (mitigación de oferta)
            const isReject = (vwapZone.side === 'sell' && currentPrice > vwap) || (vwapZone.side === 'buy' && currentPrice < vwap);
            
            if (isReject) {
                return {
                    type: 'VWAP_REJECT',
                    side: vwapZone.side === 'sell' ? 'long' : 'short',
                    description: `Rechazo en VWAP: Absorción de ${vwapZone.side === 'sell' ? 'Ventas' : 'Compras'} detectada.`,
                    confidence: 0.90,
                    timestamp: now,
                    price: currentPrice
                };
            }
        }

        // 2. Failed Auction (Rotura falsa de PDH/PDL con absorción)
        const { pdh, pdl } = this.macroLevels;
        if (pdh && currentPrice < pdh) {
            const trapAtHigh = activeZones.find(z => Math.abs(z.price - pdh) < this.tickSize * 3 && z.side === 'buy');
            if (trapAtHigh) {
                return {
                    type: 'FAILED_AUCTION_HIGH',
                    side: 'short',
                    description: `Falsa rotura de PDH con absorción de compradores. Re-entrada al rango detectada.`,
                    confidence: 0.95,
                    timestamp: now,
                    price: currentPrice
                };
            }
        }
        if (pdl && currentPrice > pdl) {
            const trapAtLow = activeZones.find(z => Math.abs(z.price - pdl) < this.tickSize * 3 && z.side === 'sell');
            if (trapAtLow) {
                return {
                    type: 'FAILED_AUCTION_LOW',
                    side: 'long',
                    description: `Falsa rotura de PDL con absorción de vendedores. Re-entrada al rango detectada.`,
                    confidence: 0.95,
                    timestamp: now,
                    price: currentPrice
                };
            }
        }

        // 3. Initial Balance Setup (IB Reject / Breakout)
        const { ibh, ibl } = this.macroLevels;
        if (ibh && ibl) {
            // IB Reject (Absorción en extremo de la primera hora)
            const atIbh = activeZones.find(z => Math.abs(z.price - ibh) < this.tickSize * 2 && z.side === 'buy');
            if (atIbh && currentPrice < ibh) {
                return {
                    type: 'IB_HIGH_REJECT',
                    side: 'short',
                    description: `Rechazo en IB High: Absorción de compradores detectada. El rango inicial actúa como techo.`,
                    confidence: 0.90,
                    timestamp: now,
                    price: currentPrice
                };
            }
        }

        // 4. Value Area Reject
        const vaZone = activeZones.find(z => Math.abs(z.price - val) < this.tickSize * 2 || Math.abs(z.price - vah) < this.tickSize * 2);
        if (vaZone) {
            return {
                type: 'VA_REJECT',
                side: vaZone.side === 'buy' ? 'short' : 'long',
                description: `Rechazo en extremo de Area de Valor`,
                confidence: 0.75,
                timestamp: now,
                price: currentPrice
            };
        }

        return null;
    }

    /**
     * Detecta absorción en una vela específica basada en el Playbook Profesional (Módulo 6.1).
     * @param candle Datos de la vela actual
     * @param delta Delta acumulado de la vela
     * @param pocPrice Precio del Point of Control (mayor volumen) de la vela
     * @returns Datos del trap detectado o null
     */
    public detectCandleAbsorption(candle: any, delta: number, pocPrice?: number): { type: 'buy_trap' | 'sell_trap', isStacked: boolean } | null {
        const volume = candle.tick_volume || candle.volume || 0;
        const range = candle.high - candle.low;
        if (range <= 0 || volume === 0) return null;

        // 1. Actualizar métricas dinámicas
        this.updateVolumeStats(volume);

        // 2. Calcular umbral dinámico (Z-Score)
        const stdDev = Math.sqrt(this.emaVariance);
        // Bajamos el multiplicador para el histórico inicial
        const currentMultiplier = this.emaVolume < 100 ? 1.0 : this.zScoreMultiplier;
        const dynamicThreshold = Math.max(this.minVolumeThreshold, this.emaVolume + (currentMultiplier * stdDev));

        // Para el histórico, permitimos que sea un poco más sensible
        const isHighEffort = volume > (dynamicThreshold * 0.6); 
        const isExtremDelta = Math.abs(delta) > volume * 0.18; 

        if (!isHighEffort || !isExtremDelta) return null;

        const closePos = (candle.close - candle.low) / range;
        
        let detectedType: 'buy_trap' | 'sell_trap' | null = null;

        // FILTRO PROFESIONAL: Ubicación del POC
        // Si no tenemos POC, permitimos la detección clásica, pero si lo tenemos aplicamos el filtro del 45% (flexibilizado para ES)
        let isPocInExtreme = true;
        if (pocPrice) {
            const pocPos = (pocPrice - candle.low) / range;
            // BEARISH: POC debe estar en el ~45% superior (0.55 a 1.0)
            if (delta > 0 && pocPos < 0.55) isPocInExtreme = false;
            // BULLISH: POC debe estar en el ~45% inferior (0.0 a 0.45)
            if (delta < 0 && pocPos > 0.45) isPocInExtreme = false;
        }

        if (!isPocInExtreme) return null;

        // BEARISH ABSORPTION: Compradores agresivos (Delta +) atrapados en el techo
        if (delta > 0 && closePos < 0.4) {
            detectedType = 'buy_trap';
        }
        // BULLISH ABSORPTION: Vendedores agresivos (Delta -) atrapados en el suelo
        else if (delta < 0 && closePos > 0.6) {
            detectedType = 'sell_trap';
        }

        if (detectedType) {
            console.log(`[OrderFlow] \u2705 SIGNAL DETECTED: ${detectedType} | Vol: ${volume.toFixed(0)} | Delta: ${delta.toFixed(0)} | ClosePos: ${closePos.toFixed(2)}`);
            const currentTime = typeof candle.time === 'number' ? candle.time : new Date(candle.time).getTime() / 1000;
            
            // Detectar Secuencialidad (Stacked)
            const isStacked = this.lastSignalType === detectedType && 
                              (currentTime - this.lastSignalTime) < (this.sequentialWindow * 60); // Asumiendo velas de 1m por ahora

            this.lastSignalType = detectedType;
            this.lastSignalTime = currentTime;

            return { type: detectedType, isStacked };
        }

        return null;
    }

    /**
     * Actualiza el volumen medio exponencial y la varianza para el cálculo de Z-Score.
     */
    private updateVolumeStats(volume: number) {
        // Inicialización (primer trade)
        if (this.emaVolume === 0) {
            this.emaVolume = volume;
            this.emaVariance = 0;
            return;
        }

        // 1. Calcular desviación respecto a la media actual
        const diff = volume - this.emaVolume;

        // 2. Actualizar EMA de Volumen
        this.emaVolume += this.smoothingFactor * diff;

        // 3. Actualizar EMA de Varianza (Desviación al cuadrado)
        // Usamos la misma constante de suavizado
        this.emaVariance += this.smoothingFactor * (Math.pow(diff, 2) - this.emaVariance);
    }
}

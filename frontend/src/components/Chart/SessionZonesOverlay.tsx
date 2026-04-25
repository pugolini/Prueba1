/**
 * SessionZonesOverlay — Dibuja zonas institucionales sobre el gráfico.
 * 
 * Basado en Módulos 4.1, 4.2 y 6.1 de la Adrianus Playbook:
 *   - POC del día anterior (zona de mayor negociación)
 *   - VAH/VAL del día anterior (extremos del value area)
 *   - Previous Day High/Low (máximos/mínimos)
 *   - Initial Balance High/Low (primeros 60 min)
 *   - Overnight High/Low
 *   - Gap RTH
 *   - Daily Bias indicator
 */

import React, { useEffect, useRef } from 'react';
import { IChartApi, ISeriesApi, LineStyle, ISeriesPrimitive } from 'lightweight-charts';
import { useStore } from '../../store/useStore';
import { RectanglePrimitive } from './plugins/RectanglePrimitive';
import { AnchoredProfilePrimitive } from './plugins/AnchoredProfilePrimitive';
import axios from 'axios';

interface SessionZonesOverlayProps {
  chart: IChartApi;
  subChart: IChartApi | null;
  series: ISeriesApi<'Candlestick'>;
}

interface PriceLineRef {
  line: any;
  key: string;
}

const SessionZonesOverlay: React.FC<SessionZonesOverlayProps> = ({ chart, subChart, series }) => {
  const { symbol, isSessionZonesEnabled, sessionZonesData, setSessionZonesData } = useStore();
  const priceLinesRef = useRef<PriceLineRef[]>([]);
  const primitivesRef = useRef<ISeriesPrimitive[]>([]);
  const cvdSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const onVwapSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const nyVwapSeriesRef = useRef<ISeriesApi<'Line'> | null>(null);
  const fetchedSymbolRef = useRef<string>('');

  // 1. POLLING DE DATOS (Actualización en Tiempo Real - Cada 30s)
  useEffect(() => {
    if (!isSessionZonesEnabled || !symbol) return;

    const fetchZones = async () => {
      try {
        const response = await axios.get(`http://127.0.0.1:8000/api/session-zones/${symbol}`);
        if (response.data && !response.data.error) {
          setSessionZonesData(response.data);
          fetchedSymbolRef.current = symbol;
        }
      } catch (err) {
        console.warn('[SessionZones] Error fetching zones:', err);
      }
    };

    // Primera carga inmediata si no hay datos o cambió el símbolo
    if (fetchedSymbolRef.current !== symbol || !sessionZonesData) {
      fetchZones();
    }

    const interval = setInterval(fetchZones, 30000); // 30 segundos
    return () => clearInterval(interval);
  }, [symbol, isSessionZonesEnabled]);

  // Dibujar/actualizar líneas de precio y CVD
  useEffect(() => {
    if (!chart || !series) return;

    if (!isSessionZonesEnabled || !sessionZonesData) {
      // Limpiar todo si se desactiva
      priceLinesRef.current.forEach(ref => {
        try { series?.removePriceLine(ref.line); } catch {}
      });
      priceLinesRef.current = [];
      
      if (cvdSeriesRef.current && subChart) {
        try { subChart.removeSeries(cvdSeriesRef.current); } catch {}
        cvdSeriesRef.current = null;
      }

      if (onVwapSeriesRef.current) {
        try { chart.removeSeries(onVwapSeriesRef.current); } catch {}
        onVwapSeriesRef.current = null;
      }

      if (nyVwapSeriesRef.current) {
        try { chart.removeSeries(nyVwapSeriesRef.current); } catch {}
        nyVwapSeriesRef.current = null;
      }

      primitivesRef.current.forEach(p => {
        try { series?.detachPrimitive(p); } catch {}
      });
      primitivesRef.current = [];
      return;
    }

    // 1. LIMPIEZA INICIAL
    priceLinesRef.current.forEach(ref => {
      try { series.removePriceLine(ref.line); } catch {}
    });
    priceLinesRef.current = [];

    if (cvdSeriesRef.current && subChart) {
      try { subChart.removeSeries(cvdSeriesRef.current); } catch {}
      cvdSeriesRef.current = null;
    }

    if (onVwapSeriesRef.current) {
      try { chart.removeSeries(onVwapSeriesRef.current); } catch {}
      onVwapSeriesRef.current = null;
    }

    if (nyVwapSeriesRef.current) {
      try { chart.removeSeries(nyVwapSeriesRef.current); } catch {}
      nyVwapSeriesRef.current = null;
    }

    primitivesRef.current.forEach(p => {
      try { series.detachPrimitive(p); } catch {}
    });
    primitivesRef.current = [];

    const zones = sessionZonesData;

    // --- GESTIÓN DE LÍNEAS DE PRECIO (POC/VAH/VAL/GAP/IB) ---
    // Limpiamos las anteriores para evitar duplicados al mover niveles (como el POC live)
    priceLinesRef.current.forEach(ref => {
      try { series.removePriceLine(ref.line); } catch {}
    });
    priceLinesRef.current = [];

    const createZoneLine = (
      key: string,
      price: number,
      color: string,
      title: string,
      lineStyle: LineStyle = LineStyle.Dashed,
      lineWidth: number = 1
    ) => {
      if (!price || price <= 0) return;
      try {
        const line = series.createPriceLine({
          price,
          color,
          lineWidth,
          lineStyle,
          axisLabelVisible: true,
          title,
        });
        priceLinesRef.current.push({ line, key });
      } catch (err) { console.warn(`[SessionZones] Error creating line ${key}:`, err); }
    };

    // Niveles Día Anterior
    createZoneLine('prev_poc', zones.prev_day.poc, 'rgba(165, 42, 42, 0.7)', '◆ POC Prev', LineStyle.Solid, 1);
    createZoneLine('prev_high', zones.prev_day.high, 'rgba(70, 130, 180, 0.6)', 'PDH', LineStyle.SparseDotted, 1);
    createZoneLine('prev_low', zones.prev_day.low, 'rgba(70, 130, 180, 0.6)', 'PDL', LineStyle.SparseDotted, 1);

    // Initial Balance (IB)
    createZoneLine('ib_high', zones.initial_balance.high, 'rgba(184, 134, 11, 0.6)', 'IB High', LineStyle.Solid, 1);
    createZoneLine('ib_low', zones.initial_balance.low, 'rgba(184, 134, 11, 0.6)', 'IB Low', LineStyle.Solid, 1);

    // Niveles Overnight Live (NUEVO: Incluye POC en tiempo real)
    createZoneLine('on_high', zones.overnight.high, 'rgba(0, 188, 212, 0.6)', 'ON High', LineStyle.SparseDotted, 1);
    createZoneLine('on_low', zones.overnight.low, 'rgba(0, 188, 212, 0.6)', 'ON Low', LineStyle.SparseDotted, 1);
    if (zones.overnight.poc > 0) {
        createZoneLine('on_poc', zones.overnight.poc, 'rgba(30, 144, 255, 0.6)', 'ON POC', LineStyle.Dotted, 1);
    }

    // Niveles RTH Live (NUEVO: POC que se mueve con el volumen NY)
    if (zones.rth && zones.rth.poc > 0) {
        createZoneLine('ny_poc', zones.rth.poc, 'rgba(156, 39, 176, 0.9)', 'NY POC', LineStyle.Dashed, 1);
        createZoneLine('ny_vah', zones.rth.vah, 'rgba(156, 39, 176, 0.4)', 'NY VAH', LineStyle.Dashed, 1);
        createZoneLine('ny_val', zones.rth.val, 'rgba(156, 39, 176, 0.4)', 'NY VAL', LineStyle.Dashed, 1);
    }

    // Gap
    if (zones.gap.size > 0 && zones.gap.direction !== 'none') {
      createZoneLine('gap_prev_close', zones.gap.prev_close, '#E040FB', `Gap ${zones.gap.direction === 'up' ? '▲' : '▼'} ${zones.gap.size.toFixed(2)}`, LineStyle.Dotted, 1);
    }

    // --- GESTIÓN DE PRIMITIVAS (RECTÁNGULOS Y PERFILES) ---
    // Limpiamos las anteriores
    primitivesRef.current.forEach(p => {
      try { series.detachPrimitive(p); } catch {}
    });
    primitivesRef.current = [];

    // Rectángulo IB
    if (zones.initial_balance.start_time && zones.initial_balance.end_time) {
      try {
        const rectangle = new RectanglePrimitive(
          [
            { time: zones.initial_balance.start_time, price: zones.initial_balance.high },
            { time: zones.initial_balance.end_time, price: zones.initial_balance.low }
          ],
          { color: 'rgba(255, 152, 0, 0.4)', width: 1, fillColor: 'rgba(255, 152, 0, 0.1)' }
        );
        series.attachPrimitive(rectangle);
        primitivesRef.current.push(rectangle);
      } catch (err) { console.warn('[SessionZones] Error IB rectangle:', err); }
    }

    // Perfil Overnight Live
    if (zones.overnight.histogram && zones.overnight.histogram.length > 0 && zones.overnight.start_time) {
      try {
        const onProfile = new AnchoredProfilePrimitive(
          zones.overnight.histogram, zones.overnight.start_time,
          zones.overnight.poc, zones.overnight.vah, zones.overnight.val,
          {
            label: 'ON', dynamicAnchor: true, vaColor: 'rgba(110, 110, 110, 0.7)',
            nonVaColor: 'rgba(230, 230, 230, 0.4)', pocColor: 'rgba(30, 144, 255, 0.9)',
            vahValColor: 'rgba(80, 80, 80, 0.7)', opacity: 0.3, widthFactor: 0.08
          }
        );
        series.attachPrimitive(onProfile);
        primitivesRef.current.push(onProfile);
      } catch (err) { console.warn('[SessionZones] Error ON Profile:', err); }
    }

    // Perfil New York (RTH) Live
    if (zones.rth && zones.rth.histogram && zones.rth.histogram.length > 0 && zones.rth.start_time) {
      try {
        const rthProfile = new AnchoredProfilePrimitive(
          zones.rth.histogram, zones.rth.start_time,
          zones.rth.poc, zones.rth.vah, zones.rth.val,
          {
            label: 'NY', dynamicAnchor: false, vaColor: 'rgba(156, 39, 176, 0.25)',
            nonVaColor: 'rgba(230, 230, 230, 0.45)', pocColor: 'rgba(156, 39, 176, 0.8)',
            vahValColor: 'rgba(156, 39, 176, 0.3)', opacity: 0.4, widthFactor: 0.12
          }
        );
        series.attachPrimitive(rthProfile);
        primitivesRef.current.push(rthProfile);
      } catch (err) { console.warn('[SessionZones] Error RTH Profile:', err); }
    }

    // --- GESTIÓN DE VWAPs (CONTINUIDAD VISUAL) ---
    // 1. ON VWAP
    if (zones.overnight.vwap && zones.overnight.vwap.length > 0) {
      if (!onVwapSeriesRef.current) {
        onVwapSeriesRef.current = chart.addLineSeries({
          color: 'rgba(30, 144, 255, 0.8)', title: 'ON VWAP', lineWidth: 1,
          priceLineVisible: false, lastValueVisible: true,
        });
      }
      onVwapSeriesRef.current.setData(zones.overnight.vwap);
    }

    // 2. NY VWAP
    if (zones.rth && zones.rth.vwap && zones.rth.vwap.length > 0) {
      if (!nyVwapSeriesRef.current) {
        nyVwapSeriesRef.current = chart.addLineSeries({
          color: 'rgba(156, 39, 176, 0.6)', title: 'NY VWAP', lineWidth: 1.5,
          priceLineVisible: false, lastValueVisible: true,
        });
      }
      nyVwapSeriesRef.current.setData(zones.rth.vwap);
    }

    // CVD en SubChart
    if (zones.current_day.cvd && zones.current_day.cvd.length > 0 && subChart) {
      if (!cvdSeriesRef.current) {
        cvdSeriesRef.current = subChart.addLineSeries({
          color: 'rgba(41, 98, 255, 0.8)', lineWidth: 1, title: 'CVD',
          priceLineVisible: false, lastValueVisible: true,
        });
      }
      cvdSeriesRef.current.setData(zones.current_day.cvd);
    }

  }, [chart, subChart, series, sessionZonesData, isSessionZonesEnabled]);

  return null;
};

export default SessionZonesOverlay;

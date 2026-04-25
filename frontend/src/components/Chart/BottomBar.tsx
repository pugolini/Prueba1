import React, { useEffect, useState } from 'react';
import { useStore } from '../../store/useStore';
import axios from 'axios';

const BottomBar: React.FC = () => {
  const { 
    symbol, chartRange, setChartRange,
    isMarketOpen, setMarketOpen,
    mt5Connected, setMT5Connected
  } = useStore();

  const [currentTime, setCurrentTime] = useState(new Date());

  // 1. Reloj en tiempo real
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // 2. Polling de estado del mercado y conexión
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const response = await axios.get(`http://127.0.0.1:8000/api/status/${symbol}`);
        setMarketOpen(response.data.market_open);
        setMT5Connected(response.data.mt5_connected);
      } catch (error) {
        console.error("Error al obtener estado:", error);
        setMT5Connected(false);
        setMarketOpen(false);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 5000);
    return () => clearInterval(interval);
  }, [symbol, setMarketOpen, setMT5Connected]);

  const ranges = ['1D', '5D', '1M', '3M', '6M', 'YTD', '1Y', 'Todo'];

  return (
    <div className="bottombar-tv">
      <div className="flex items-center gap-4">
        <div className={`flex items-center gap-1.5 ${mt5Connected ? 'text-success' : 'text-error'}`}>
          <div className={`w-2 h-2 rounded-full ${mt5Connected ? 'bg-success animate-pulse' : 'bg-error'}`} />
          <span className="font-bold uppercase tracking-wider">
            {mt5Connected ? 'Metatrader 5 Conectado' : 'MT5 Desconectado'}
          </span>
        </div>
        <div className="topbar-divider" />
        <div className="flex items-center gap-4 text-on-surface-variant font-medium">
          {ranges.map(r => (
            <button 
              key={r}
              onClick={() => setChartRange(r)}
              className={`hover:text-white transition-colors ${chartRange === r ? 'text-primary' : ''}`}
            >
              {r}
            </button>
          ))}
        </div>
      </div>
      
      <div className="flex-1" />
      
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="text-on-surface font-mono font-bold">
            {currentTime.toLocaleTimeString('es-ES', { hour12: false })}
          </span>
          <span className="text-[10px] font-bold">(LOCAL)</span>
        </div>
        <div className="topbar-divider" />
        <div className={`flex items-center gap-1.5 ${isMarketOpen ? 'text-success' : 'text-on-surface-variant'}`}>
          <span className="font-bold uppercase">
            {isMarketOpen ? 'Mercados Abiertos' : 'Mercados Cerrados'}
          </span>
        </div>
      </div>
    </div>
  );
};

export default BottomBar;


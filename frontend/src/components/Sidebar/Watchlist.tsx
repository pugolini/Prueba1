import React from 'react';
import { useStore } from '../../store/useStore';
import { TrendingUp, Globe, Bitcoin, Plus, Search } from 'lucide-react';

const Watchlist: React.FC = () => {
  const { 
    watchlist, 
    symbol: activeSymbol, 
    setSymbol, 
    setSymbolSearchOpen,
    fetchWatchlist,
    watchlistPrices 
  } = useStore();

  // Polling de precios para la watchlist
  React.useEffect(() => {
    fetchWatchlist(); // Carga inicial
    const interval = setInterval(fetchWatchlist, 10000); // Cada 10s
    return () => clearInterval(interval);
  }, [fetchWatchlist, watchlist]);

  const getIcon = (s: string) => {
    if (s.includes('BTC') || s.includes('ETH')) return <Bitcoin size={14}/>;
    if (s.includes('EUR') || s.includes('USD') || s.includes('XAU')) return <Globe size={14}/>;
    return <TrendingUp size={14}/>;
  };

  return (
    <div className="flex flex-col h-full bg-surface-low overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 flex items-center justify-between border-b border-white/5">
        <span className="text-[11px] font-bold uppercase tracking-widest text-on-surface-variant">Lista de Seguimiento</span>
        <Plus 
          className="text-on-surface-variant hover:text-white cursor-pointer transition-colors" 
          size={16} 
          onClick={() => setSymbolSearchOpen(true)}
        />
      </div>

      {/* Quick Search */}
      <div className="p-4 bg-surface-highest">
        <div className="relative flex-row-tv">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant" size={14} />
          <input 
            type="text" 
            placeholder="Buscar activo..." 
            className="tv-input !pl-9 !py-1.5 !text-[11px]"
          />
        </div>
      </div>


      {/* Symbols Table */}
      <div className="flex-1 overflow-y-auto custom-scrollbar">
        <table className="w-full text-left">
          <thead className="border-b border-white/5">
            <tr>
              <th className="px-4 py-3 tv-header-text">Símbolo</th>
              <th className="px-4 py-3 text-right tv-header-text">Último</th>
            </tr>
          </thead>
          <tbody>
            {watchlist.map(s => {
              const data = watchlistPrices[s];
              const price = data?.price ? data.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '---';
              
              return (
                <tr 
                  key={s}
                  onClick={() => setSymbol(s)}
                  className={`tv-row group ${activeSymbol === s ? 'active' : ''}`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-on-surface-variant group-hover:text-blue-400">
                        {getIcon(s)}
                      </span>
                      <span className={`text-xs font-bold ${activeSymbol === s ? 'text-primary-tv' : 'text-on-surface'}`}>
                        {s.split('.')[0]}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="text-xs font-mono font-bold text-on-surface">
                      {data?.error ? 'Error' : price}
                    </div>
                    <div className="text-[10px] text-on-surface-variant">
                      {data?.price ? 'Live' : '-0.00%'}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

    </div>
  );
};


export default Watchlist;

import React, { useState, useEffect } from 'react';
import { Search, X, TrendingUp, Globe, Bitcoin } from 'lucide-react';
import { useStore } from '../../store/useStore';

const SymbolSearchModal: React.FC = () => {
  const { isSymbolSearchOpen, setSymbolSearchOpen, setSymbol, symbol: activeSymbol } = useStore();
  const [query, setQuery] = useState('');

  // Extended asset list with categories
  const allAssets = [
    { id: 'NAS100.pro', name: 'Nasdaq 100', type: 'Indices', icon: <TrendingUp size={14}/> },
    { id: 'GER30.pro', name: 'DAX 40', type: 'Indices', icon: <TrendingUp size={14}/> },
    { id: 'US30.pro', name: 'Dow Jones', type: 'Indices', icon: <TrendingUp size={14}/> },
    { id: 'EURUSD.pro', name: 'Euro / US Dollar', type: 'Forex', icon: <Globe size={14}/> },
    { id: 'XAUUSD.pro', name: 'Gold / US Dollar', type: 'Commodities', icon: <Globe size={14}/> },
    { id: 'BTCUSD.pro', name: 'Bitcoin / US Dollar', type: 'Crypto', icon: <Bitcoin size={14}/> },
    { id: 'ETHUSD.pro', name: 'Ethereum / US Dollar', type: 'Crypto', icon: <Bitcoin size={14}/> },
    { id: 'GBPUSD.pro', name: 'British Pound / US Dollar', type: 'Forex', icon: <Globe size={14}/> },
    { id: 'USDJPY.pro', name: 'US Dollar / Yen', type: 'Forex', icon: <Globe size={14}/> },
  ];

  const filtered = allAssets.filter(a => 
    a.id.toLowerCase().includes(query.toLowerCase()) || 
    a.name.toLowerCase().includes(query.toLowerCase())
  );

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSymbolSearchOpen(false);
    };
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  if (!isSymbolSearchOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="tv-modal w-[800px] h-[600px] shadow-2xl relative">

        {/* Header */}
        <div className="px-6 py-4 flex items-center justify-between border-b border-white/5 bg-surface-highest">
          <span className="text-base font-bold text-white tracking-tight">Buscar activos</span>
          <button 
            onClick={() => setSymbolSearchOpen(false)}
            className="p-1 hover:bg-surface-high rounded transition-colors text-on-surface-variant hover:text-white"
          >
            <X size={20} />
          </button>
        </div>

        {/* Search Input Container */}
        <div className="px-6 py-6 bg-surface-highest">
          <div className="relative group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-on-surface-variant" size={20} />
            <input 
              autoFocus
              type="text"
              placeholder="Símbolo, nombre o mercado..."
              className="tv-input !pl-12 !py-4 !text-base"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>


        {/* Categories Tabs */}
        <div className="flex gap-2 px-6 pb-2 bg-surface-highest">
          {['Todos', 'Forex', 'Crypto', 'Indices'].map(cat => (
            <button 
              key={cat}
              className={`px-3 py-1.5 rounded text-[11px] font-bold uppercase tracking-wider transition-colors ${cat === 'Todos' ? 'bg-primary-tv text-white' : 'bg-surface-low text-on-surface-variant hover:bg-surface-high'}`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Assets List */}
        <div className="flex-1 overflow-y-auto px-2 pb-4 bg-surface-highest custom-scrollbar">
          {filtered.length > 0 ? (
            filtered.map(asset => (
              <div 
                key={asset.id}
                onClick={() => {
                  setSymbol(asset.id);
                  setSymbolSearchOpen(false);
                }}
                className={`flex items-center justify-between px-4 py-3 rounded-md cursor-pointer transition-all mx-2 ${activeSymbol === asset.id ? 'bg-primary-tv/10' : 'hover:bg-white/5'}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`p-2 rounded bg-surface-low text-on-surface-variant flex items-center justify-center`}>
                    {asset.icon}
                  </div>
                  <div>
                    <div className="text-[13px] font-bold text-white flex items-center gap-2">
                      {asset.id.split('.')[0]}
                      {activeSymbol === asset.id && <span className="text-[9px] bg-primary-tv text-white px-1.5 py-0.5 rounded font-black">ACTIVO</span>}
                    </div>
                    <div className="text-[11px] text-on-surface-variant font-medium">{asset.name}</div>
                  </div>
                </div>
                <div className="text-[10px] text-on-surface-variant font-bold uppercase tracking-widest bg-white/5 px-2 py-1 rounded">
                  {asset.type}
                </div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-20 opacity-40">
              <Search size={48} className="mb-4" />
              <div className="text-sm font-medium">No se encontraron activos para "{query}"</div>
            </div>
          )}
        </div>

        {/* Footer shortcuts */}
        <div className="px-6 py-3 border-t border-white/5 bg-surface-high flex items-center gap-4 text-[10px] font-bold text-on-surface-variant uppercase tracking-widest">
           <span className="flex items-center gap-1"><span className="bg-surface-highest px-1.5 py-0.5 rounded border border-white/10 italic text-white font-mono lowercase">esc</span> cerrar</span>
           <span className="flex items-center gap-1"><span className="bg-surface-highest px-1.5 py-0.5 rounded border border-white/10 italic text-white font-mono lowercase">enter</span> seleccionar</span>
        </div>
      </div>
    </div>
  );
};


export default SymbolSearchModal;

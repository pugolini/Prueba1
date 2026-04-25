import React, { useState, useEffect } from 'react';
import { useStore } from '../../store/useStore';
import { X, ChevronDown, CheckSquare, Square, ShieldCheck, AlertTriangle } from 'lucide-react';

const OrderTicket: React.FC = () => {
  const { 
    symbol, isOrderTicketOpen, setOrderTicketOpen, defaultLot, setDefaultLot, placeTradingOrder,
    lastTickPrice, positions, rithmicConfig, bigTradesData
  } = useStore();
  
  const [ocoEnabled, setOcoEnabled] = useState(false);
  const [serverMode, setServerMode] = useState('server');
  const [dailyPnl, setDailyPnl] = useState(0);
  const [tradesCount, setTradesCount] = useState(0);
  const [riskMode, setRiskMode] = useState<'funded' | 'own'>('funded'); // 5 vs 10 balas
  const [maxTradesPerSession] = useState(5);
  const [maxDailyLoss] = useState(-2000);

  const isLocked = tradesCount >= maxTradesPerSession || dailyPnl <= maxDailyLoss;
  const [slTicks, setSlTicks] = useState(10);
  const [tpTicks, setTpTicks] = useState(20);
  const [suggestedSL, setSuggestedSL] = useState<{price: number, desc: string} | null>(null);

  // Derivados de cuenta falsos o simulados
  const openPnL = positions.reduce((acc, p) => acc + (p.profit || 0), 0);
  const openQty = positions.reduce((acc, p) => acc + p.volume, 0);

  // Inteligencia de Order Flow para Stop Loss
  useEffect(() => {
    if (!lastTickPrice || bigTradesData.length === 0) return;
    
    // Buscar la absorción más cercana para proteger el SL (Tip del Mentor)
    const recentTrades = bigTradesData.slice(-50);
    const buyAbsorptions = recentTrades.filter(t => t.side === 'sell' && t.size > 100); // Vendedores absorbidos
    const sellAbsorptions = recentTrades.filter(t => t.side === 'buy' && t.size > 100); // Compradores absorbidos

    if (buyAbsorptions.length > 0) {
        const closest = buyAbsorptions[buyAbsorptions.length - 1];
        if (lastTickPrice > closest.price) {
            setSuggestedSL({ price: closest.price - 0.50, desc: 'Protección bajo absorción vendedora' });
        }
    } else if (sellAbsorptions.length > 0) {
        const closest = sellAbsorptions[sellAbsorptions.length - 1];
        if (lastTickPrice < closest.price) {
            setSuggestedSL({ price: closest.price + 0.50, desc: 'Protección sobre absorción compradora' });
        }
    }
  }, [lastTickPrice, bigTradesData]);

  const handleExecute = async (side: 'buy' | 'sell', type: string) => {
    if (isLocked) return;
    try {
        let orderType = type;
        if (type === 'MKT') orderType = side === 'buy' ? 'BUY_MKT' : 'SELL_MKT';
        if (type === 'LMT' || type === 'BID' || type === 'ASK') orderType = side === 'buy' ? 'BUY_LIMIT' : 'SELL_LIMIT';
        if (type === 'STP') orderType = side === 'buy' ? 'BUY_STOP' : 'SELL_STOP';

        const price = lastTickPrice || 0; 

        // Si hay un SL sugerido y OCO activo, lo usamos
        let finalSL = 0;
        if (ocoEnabled) {
            if (suggestedSL) {
                finalSL = suggestedSL.price;
            } else {
                finalSL = side === 'buy' ? price - (slTicks * 0.25) : price + (slTicks * 0.25);
            }
        }

        await placeTradingOrder({
            symbol,
            type: orderType,
            lot: defaultLot,
            price: price,
            sl: finalSL,
            tp: ocoEnabled ? (side === 'buy' ? price + (tpTicks * 0.25) : price - (tpTicks * 0.25)) : 0
        });
        setTradesCount(prev => prev + 1);
    } catch (e) {
        console.error(e);
    }
  };

  const applySuggestedSL = () => {
    if (!suggestedSL || !lastTickPrice) return;
    const diffTicks = Math.abs(lastTickPrice - suggestedSL.price) / 0.25;
    setSlTicks(Math.round(diffTicks));
    setOcoEnabled(true);
  };

  if (!isOrderTicketOpen) return null;

  return (
    <div className="order-ticket-panel h-full flex flex-col bg-[#111111] text-gray-300 w-[240px] border-l border-[#222] font-sans selection:bg-purple-900 overflow-hidden text-xs">
      {/* Header superior verde (Daily P/L Global) */}
      <div className="h-6 flex w-full">
         <div className="flex-1 bg-[#1a3a2a] text-[#00e676] font-bold flex items-center px-2 border-b border-black">
           $ <span className="ml-auto">{dailyPnl.toFixed(2)}</span>
         </div>
      </div>

      {/* Contenedor principal con scroll */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-3">
        
        {/* Selector de Contrato Falso */}
        <div className="bg-[#1e1e1e] border border-[#333] rounded flex items-center justify-between px-2 py-1.5 cursor-pointer">
          <span className="font-bold text-[#ddd]">{symbol.split('.')[0]}-202603</span>
          <ChevronDown size={14} className="text-gray-500" />
        </div>

        {/* Risk Guardian Header */}
        <div className={`p-2 rounded flex justify-between items-center text-xs mb-4 ${isLocked ? 'bg-red-900/40' : 'bg-slate-800'}`}>
            <div className="flex flex-col">
                <span className="text-slate-400">PNL DIARIO / TRADES</span>
                <span className={`font-bold ${dailyPnl < 0 ? 'text-red-400' : 'text-green-400'}`}>
                    ${dailyPnl.toFixed(2)} / {tradesCount}
                </span>
            </div>
            <div className="flex flex-col items-end">
                <span className="text-slate-400">ESTADO</span>
                <span className={`font-bold ${isLocked ? 'text-red-500' : 'text-green-500'}`}>
                    {isLocked ? 'BLOQUEADO (REGLAS)' : 'OPERATIVO'}
                </span>
            </div>
        </div>

        {/* Selector de Balas (Módulo 5) */}
        <div className="flex gap-2 mb-4">
            <button 
               onClick={() => setRiskMode('funded')}
               className={`flex-1 py-1 text-xs rounded border ${riskMode === 'funded' ? 'bg-orange-600/20 border-orange-500 text-orange-400' : 'border-slate-700 text-slate-500'}`}
            >
               Fondeada (5 Balas)
            </button>
            <button 
               onClick={() => setRiskMode('own')}
               className={`flex-1 py-1 text-xs rounded border ${riskMode === 'own' ? 'bg-blue-600/20 border-blue-500 text-blue-400' : 'border-slate-700 text-slate-500'}`}
            >
               Propio (10 Balas)
            </button>
        </div>

        {/* PnL Box */}
        <div className="space-y-4">
          <div className="flex justify-between items-center text-[11px]">
             <span className="text-gray-400">Open Qty</span>
             <span className="font-mono text-[#aaa]">{openQty}</span>
          </div>
          <div className="flex justify-between items-center text-[11px]">
             <span className="text-gray-400">Open P/L</span>
             <span className="font-mono text-[#aaa]">{openPnL.toFixed(2)} $</span>
          </div>
          <div className="flex justify-between items-center text-[11px] bg-[#1a3a2a] px-1 py-0.5 rounded text-[#00e676]">
             <span className="font-bold">Daily P/L</span>
             <span className="font-mono font-bold">{dailyPnl.toFixed(2)} $</span>
          </div>
        </div>

        {/* --- SMART AI SUGGESTION --- */}
        {suggestedSL && (
            <div className="bg-blue-500/10 border border-blue-500/30 p-2 rounded animate-pulse cursor-pointer" onClick={applySuggestedSL}>
                <div className="flex items-center gap-2 text-blue-400 font-bold text-[10px]">
                    <ShieldCheck size={14} />
                    SMART SL SUGGESTION
                </div>
                <div className="text-[9px] text-gray-400 mt-1">
                    {suggestedSL.desc}
                </div>
                <div className="text-[10px] text-blue-300 mt-1 font-mono">
                    SL sugerido: {suggestedSL.price.toFixed(2)}
                </div>
            </div>
        )}

        <div className="h-px bg-[#333]" />

        {/* Account Info Form */}
        <div className="space-y-2">
            <div className="flex items-center gap-2">
               <span className="text-gray-400 w-12 text-right">Qty</span>
               <div className="flex-1 bg-[#1e1e1e] border border-[#333] flex items-center justify-between px-2 py-1 rounded">
                 <input type="number" min="1" className="bg-transparent w-full outline-none font-mono text-[#ddd]" value={defaultLot} onChange={(e) => setDefaultLot(Number(e.target.value))} />
               </div>
            </div>
            <div className="flex items-center gap-2">
               <span className="text-gray-400 w-12 text-right">Broker</span>
               <div className="flex-1 bg-[#1e1e1e] border border-[#333] flex items-center justify-between px-2 py-1 rounded cursor-not-allowed">
                 <span className="font-mono text-[#aaa]">rithmic</span><ChevronDown size={12}/>
               </div>
            </div>
            <div className="flex items-center gap-2">
               <span className="text-gray-400 w-12 text-right">Account</span>
               <div className="flex-1 bg-[#1e1e1e] border border-[#333] flex items-center justify-between px-2 py-1 rounded cursor-not-allowed">
                 <span className="font-mono text-[#aaa]">********01</span><ChevronDown size={12}/>
               </div>
            </div>
        </div>

        {/* Execution Grid */}
        <div className="pt-2">
            <div className="flex pb-1">
                <div className="w-1/2 text-center text-gray-500 font-bold uppercase tracking-wider text-[10px]">Buy</div>
                <div className="w-1/2 text-center text-gray-500 font-bold uppercase tracking-wider text-[10px]">Sell</div>
            </div>
            <div className="grid grid-cols-2 gap-[1px] bg-[#111]">
                <button onClick={() => handleExecute('buy', 'MKT')} className="bg-[#4caf50] hover:bg-[#388e3c] text-black font-extrabold py-2 border-t border-l border-b border-[#333]">MKT</button>
                <button onClick={() => handleExecute('sell', 'MKT')} className="bg-[#9c27b0] hover:bg-[#7b1fa2] text-white font-extrabold py-2 border-t border-r border-b border-[#333]">MKT</button>
                
                <button onClick={() => handleExecute('buy', 'BID')} className="bg-[#4caf50] hover:bg-[#388e3c] text-black font-extrabold py-2 border-b border-l border-[#333]">BID</button>
                <button onClick={() => handleExecute('sell', 'ASK')} className="bg-[#9c27b0] hover:bg-[#7b1fa2] text-white font-extrabold py-2 border-b border-r border-[#333]">ASK</button>
                
                <button onClick={() => handleExecute('buy', 'LMT')} className="bg-[#4caf50] hover:bg-[#388e3c] text-black font-extrabold py-2 border-b border-l border-[#333]">LMT</button>
                <button onClick={() => handleExecute('sell', 'LMT')} className="bg-[#9c27b0] hover:bg-[#7b1fa2] text-white font-extrabold py-2 border-b border-r border-[#333]">LMT</button>

                <button onClick={() => handleExecute('buy', 'STP')} className="bg-[#4caf50] hover:bg-[#388e3c] text-black font-extrabold py-2 border-b border-l border-[#333]">STP</button>
                <button onClick={() => handleExecute('sell', 'STP')} className="bg-[#9c27b0] hover:bg-[#7b1fa2] text-white font-extrabold py-2 border-b border-r border-[#333]">STP</button>
            </div>
            <div className="grid grid-cols-2 gap-1 mt-1">
                <button className="bg-[#f57c00] hover:bg-[#e65100] text-black font-bold py-1.5 rounded-sm">Cancel</button>
                <button className="bg-[#f57c00] hover:bg-[#e65100] text-black font-bold py-1.5 rounded-sm">Breakeven</button>
            </div>
            <button className="w-full bg-[#f57c00] hover:bg-[#e65100] text-black font-bold py-2 mt-1 rounded-sm uppercase tracking-tighter">Cancel and Flat</button>
        </div>

        {/* OCO Strategy */}
        <div className="border border-[#333] p-2 mt-2 bg-[#1a1a1a] rounded">
            <div className="flex items-center justify-between mb-2">
               <span className="font-bold text-[#bbb]">OCO Strategy</span>
               <div className="relative inline-block w-8 h-4 cursor-pointer" onClick={() => setOcoEnabled(!ocoEnabled)}>
                  <div className={`block w-8 h-4 rounded-full transition-colors ${ocoEnabled ? 'bg-[#ff9800]' : 'bg-[#333]'}`}></div>
                  <div className={`absolute left-1 top-1 bg-white w-2 h-2 rounded-full transition-transform ${ocoEnabled ? 'transform translate-x-4' : ''}`}></div>
               </div>
            </div>
            
            <div className={`transition-opacity ${ocoEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                <div className="flex gap-2">
                    <span className="text-gray-500 w-10">Mode</span>
                    <span className="text-[#eee] flex-1">SL / TP</span>
                </div>
                <div className="flex gap-2 mt-2 items-center">
                    <span className="text-gray-500 w-8">SL</span>
                    <input type="number" className="bg-[#222] border border-[#444] rounded w-full py-1 text-center font-mono text-[#eee]" value={slTicks} onChange={e=>setSlTicks(Number(e.target.value))} />
                    <span className="text-gray-500 w-10">Ticks</span>
                </div>
                <div className="flex gap-2 mt-1 items-center">
                    <span className="text-gray-500 w-8">TP</span>
                    <input type="number" className="bg-[#222] border border-[#444] rounded w-full py-1 text-center font-mono text-[#eee]" value={tpTicks} onChange={e=>setTpTicks(Number(e.target.value))} />
                    <span className="text-gray-500 w-10">Ticks</span>
                </div>
            </div>
        </div>

        {/* Footers controls */}
        <div className="flex justify-between items-center py-2 text-gray-500">
             <label className="flex items-center gap-1 cursor-pointer hover:text-gray-300">
               {serverMode === 'server' ? <CheckSquare size={12}/> : <Square size={12}/>}
               <span onClick={() => setServerMode('server')}>Server</span>
             </label>
             <label className="flex items-center gap-1 cursor-pointer hover:text-gray-300">
                {serverMode === 'client' ? <CheckSquare size={12}/> : <Square size={12}/>}
                <span onClick={() => setServerMode('client')}>Client</span>
             </label>
        </div>
      </div>

      {/* DeepDOM Bottom Tabs */}
      <div className="flex bg-[#000] border-t border-[#333] h-6 items-center px-2">
         <span className="text-[#888] font-bold mr-auto uppercase text-[9px]">Trading Terminal</span>
         <span className="text-primary-tv mx-2 font-bold text-[9px]">Pugobot 1.0</span>
      </div>
    </div>
  );
};

export default OrderTicket;

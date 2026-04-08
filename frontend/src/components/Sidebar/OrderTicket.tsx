import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { X, ChevronDown, CheckSquare, Square } from 'lucide-react';

const OrderTicket: React.FC = () => {
  const { 
    symbol, isOrderTicketOpen, setOrderTicketOpen, defaultLot, setDefaultLot, placeTradingOrder,
    lastTickPrice, positions, rithmicConfig
  } = useStore();
  
  const [ocoEnabled, setOcoEnabled] = useState(false);
  const [serverMode, setServerMode] = useState('server');
  const [slTicks, setSlTicks] = useState(10);
  const [tpTicks, setTpTicks] = useState(20);

  // Derivados de cuenta falsos o simulados
  const dailyPnL = 893.70;
  const openPnL = positions.reduce((acc, p) => acc + (p.profit || 0), 0);
  const openQty = positions.reduce((acc, p) => acc + p.volume, 0);

  const handleExecute = async (side: 'buy' | 'sell', type: string) => {
    try {
        let orderType = type;
        if (type === 'MKT') orderType = side === 'buy' ? 'BUY_MKT' : 'SELL_MKT';
        if (type === 'LMT' || type === 'BID' || type === 'ASK') orderType = side === 'buy' ? 'BUY_LIMIT' : 'SELL_LIMIT';
        if (type === 'STP') orderType = side === 'buy' ? 'BUY_STOP' : 'SELL_STOP';

        const price = lastTickPrice || 0; // Simplificado para simulación de MKT

        await placeTradingOrder({
            symbol,
            type: orderType,
            lot: defaultLot,
            price: price,
            sl: ocoEnabled ? price - (slTicks * 0.25) : 0, // asumiendo tickSize 0.25 para NQ
            tp: ocoEnabled ? price + (tpTicks * 0.25) : 0
        });
    } catch (e) {
        console.error(e);
    }
  };

  if (!isOrderTicketOpen) return null;

  return (
    <div className="order-ticket-panel h-full flex flex-col bg-[#111111] text-gray-300 w-[240px] border-l border-[#222] font-sans selection:bg-purple-900 overflow-hidden text-xs">
      {/* Header superior verde (Daily P/L Global) */}
      <div className="h-6 flex w-full">
         <div className="flex-1 bg-[#1a3a2a] text-[#00e676] font-bold flex items-center px-2 border-b border-black">
           $ <span className="ml-auto">{dailyPnL.toFixed(2)}</span>
         </div>
      </div>

      {/* Contenedor principal con scroll */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2 space-y-3">
        
        {/* Selector de Contrato Falso */}
        <div className="bg-[#1e1e1e] border border-[#333] rounded flex items-center justify-between px-2 py-1.5 cursor-pointer">
          <span className="font-bold text-[#ddd]">{symbol.split('.')[0]}-202603</span>
          <ChevronDown size={14} className="text-gray-500" />
        </div>

        {/* PnL Box */}
        <div className="space-y-1">
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
             <span className="font-mono font-bold">{dailyPnL.toFixed(2)} $</span>
          </div>
        </div>

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
            <div className="flex items-center gap-2">
               <button className="text-gray-400 hover:text-white" onClick={() => setOrderTicketOpen(false)}><X size={12} /></button>
               <span className="text-gray-400 text-right flex-1">Ticks diff.</span>
               <div className="w-16 bg-[#1e1e1e] border border-[#333] flex items-center px-2 py-1 rounded text-[#ddd]">0</div>
            </div>
        </div>

        {/* Execution Grid (Las Joyas de la Corona) */}
        <div className="pt-2">
            <div className="flex pb-1">
                <div className="w-1/2 text-center text-gray-500 font-bold uppercase tracking-wider text-[10px]">Buy</div>
                <div className="w-1/2 text-center text-gray-500 font-bold uppercase tracking-wider text-[10px]">Sell</div>
            </div>
            <div className="grid grid-cols-2 gap-[1px] bg-[#111]">
                {/* MKT */}
                <button onClick={() => handleExecute('buy', 'MKT')} className="bg-[#4caf50] hover:bg-[#388e3c] text-black font-extrabold py-2 border-t border-l border-b border-[#333]">MKT</button>
                <button onClick={() => handleExecute('sell', 'MKT')} className="bg-[#9c27b0] hover:bg-[#7b1fa2] text-white font-extrabold py-2 border-t border-r border-b border-[#333]">MKT</button>
                
                {/* BID / ASK */}
                <button onClick={() => handleExecute('buy', 'BID')} className="bg-[#4caf50] hover:bg-[#388e3c] text-black font-extrabold py-2 border-b border-l border-[#333]">BID</button>
                <button onClick={() => handleExecute('sell', 'ASK')} className="bg-[#9c27b0] hover:bg-[#7b1fa2] text-white font-extrabold py-2 border-b border-r border-[#333]">ASK</button>
                
                {/* LMT */}
                <button onClick={() => handleExecute('buy', 'LMT')} className="bg-[#4caf50] hover:bg-[#388e3c] text-black font-extrabold py-2 border-b border-l border-[#333]">LMT</button>
                <button onClick={() => handleExecute('sell', 'LMT')} className="bg-[#9c27b0] hover:bg-[#7b1fa2] text-white font-extrabold py-2 border-b border-r border-[#333]">LMT</button>

                {/* STP */}
                <button onClick={() => handleExecute('buy', 'STP')} className="bg-[#4caf50] hover:bg-[#388e3c] text-black font-extrabold py-2 border-b border-l border-[#333]">STP</button>
                <button onClick={() => handleExecute('sell', 'STP')} className="bg-[#9c27b0] hover:bg-[#7b1fa2] text-white font-extrabold py-2 border-b border-r border-[#333]">STP</button>

                {/* STP LMT */}
                <button onClick={() => handleExecute('buy', 'STP_LMT')} className="bg-[#4caf50] hover:bg-[#388e3c] text-black font-extrabold py-2 border-b border-l border-[#333] text-[10px]">STP LMT</button>
                <button onClick={() => handleExecute('sell', 'STP_LMT')} className="bg-[#9c27b0] hover:bg-[#7b1fa2] text-white font-extrabold py-2 border-b border-r border-[#333] text-[10px]">STP LMT</button>
            </div>
            <div className="grid grid-cols-2 gap-1 mt-1">
                <button className="bg-[#f57c00] hover:bg-[#e65100] text-black font-bold py-1.5 rounded-sm">Cancel</button>
                <button className="bg-[#f57c00] hover:bg-[#e65100] text-black font-bold py-1.5 rounded-sm">Breakeven</button>
            </div>
            <button className="w-full bg-[#f57c00] hover:bg-[#e65100] text-black font-bold py-2 mt-1 rounded-sm">Cancel and Flat</button>
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
        <button className="w-full border border-[#00e676] text-[#00e676] hover:bg-[#00e676] hover:text-black transition-colors py-1.5 font-bold uppercase rounded-sm">Link pending orders</button>
      </div>

      {/* DeepDOM Bottom Tabs */}
      <div className="flex bg-[#000] border-t border-[#333] h-6 items-center px-2">
         <span className="text-[#888] font-bold mr-auto">DOM</span>
         <span className="text-[#fff] mx-2 cursor-pointer font-bold border-b-2 border-white">T. Panel</span>
         <span className="text-[#888] cursor-pointer hover:text-white font-bold ml-2">T&S</span>
      </div>
    </div>
  );
};

export default OrderTicket;

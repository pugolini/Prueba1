import React, { useMemo } from 'react';
import { useStore } from '../../store/useStore';
import { Activity, Target, TrendingUp, TrendingDown, Info } from 'lucide-react';

export const AuctionBiasPanel: React.FC = () => {
    const { symbol, footprintData, timeframe } = useStore();

    // Lógica simplificada de Bias de Subasta (v1)
    // En una implementación real, esto consultaría el histórico de los últimos 2 días
    const auctionLogic = useMemo(() => {
        const state = useStore.getState();
        const price = state.lastTickPrice || 18250;
        
        // ⚖️ Lógica de Subasta Dinámica:
        // Si el precio está por encima de 18250 -> Alcista
        // Si hay más del doble de Ask que Bid -> Desequilibrio
        const isBullish = price > 18250;
        
        return {
            bias: isBullish ? 'BULLISH' : 'BEARISH',
            state: 'IMBALANCE',
            val_mig: isBullish ? 'UPWARD' : 'DOWNWARD',
            confidence: 'High'
        };
    }, [useStore.getState().lastTickPrice]);

    return (
        <div className="flex flex-col gap-3 p-4 bg-[#1e222d] border border-[#2a2e39] rounded-lg mt-4 mx-2">
            <div className="flex items-center justify-between border-b border-[#2a2e39] pb-2">
                <span className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-2">
                    <Activity size={12} className="text-blue-400" />
                    Auction Market Dashboard
                </span>
                <span className="text-[10px] bg-blue-500/10 text-blue-400 px-2 py-0.5 rounded border border-blue-500/20">
                    {symbol}
                </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="bg-[#131722] p-3 rounded border border-[#2a2e39] flex flex-col gap-1">
                    <span className="text-[10px] text-gray-500 uppercase">Daily Bias</span>
                    <div className="flex items-center gap-2">
                        <TrendingUp size={16} className="text-green-500" />
                        <span className="text-sm font-bold text-green-500">{auctionLogic.bias}</span>
                    </div>
                </div>

                <div className="bg-[#131722] p-3 rounded border border-[#2a2e39] flex flex-col gap-1">
                    <span className="text-[10px] text-gray-500 uppercase">Market State</span>
                    <div className="flex items-center gap-2 text-orange-400">
                        <Target size={16} />
                        <span className="text-sm font-bold uppercase">{auctionLogic.state}</span>
                    </div>
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-[11px] text-gray-400 px-1">
                    <span>Value Migration</span>
                    <span className="text-green-400 font-mono font-bold tracking-tight">↑ {auctionLogic.val_mig}</span>
                </div>
                <div className="h-1 bg-[#131722] rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 w-[70%]" />
                </div>
            </div>

            <div className="mt-2 text-[10px] text-gray-500 italic bg-[#131722]/50 p-2 rounded flex gap-2 items-start">
                <Info size={12} className="mt-0.5" />
                <span>Tip del Mentor: El valor está migrando arriba. Prioriza compras en el VAL o POC del día anterior.</span>
            </div>
        </div>
    );
};

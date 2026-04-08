import React from 'react';
import { useStore } from '../../store/useStore';
import { X, TrendingUp, TrendingDown, Wallet, Zap } from 'lucide-react';

const PositionsPanel: React.FC = () => {
    const { 
        positions, 
        pendingOrders,
        positionHistory,
        accountInfo, 
        closeTradingPosition, 
        symbol 
    } = useStore();

    const [activeTab, setActiveTab] = React.useState<'positions' | 'orders' | 'history'>('positions');

    if (!accountInfo) return null;

    const TabButton = ({ id, label, count }: { id: any, label: string, count: number }) => (
        <button
            onClick={() => setActiveTab(id)}
            className={`px-4 py-2 text-[10px] font-bold uppercase tracking-widest transition-all border-b-2 ${
                activeTab === id 
                ? 'text-[var(--primary-tv)] border-[var(--primary-tv)] bg-[var(--primary-tv)]/5' 
                : 'text-[var(--on-surface-variant)] opacity-50 border-transparent hover:opacity-100'
            }`}
        >
            {label} {count > 0 && <span className="ml-1 opacity-60">({count})</span>}
        </button>
    );

    return (
        <div className="flex flex-col h-full bg-[var(--surface-dim)] border-t border-[var(--border-ghost)] text-[var(--on-surface-variant)] font-sans select-none overflow-hidden" style={{ gridArea: 'bottom-panel' }}>
            {/* Account Summary Bar */}
            <div className="flex items-center gap-6 px-4 py-2 bg-[var(--surface-low)] border-b border-[var(--border-ghost)] text-[10px] font-bold uppercase tracking-wider overflow-x-auto no-scrollbar">
                <div className="flex items-center gap-2 text-[var(--primary-tv)]">
                    <Wallet size={12} />
                    <span>Balance:</span>
                    <span className="text-[var(--on-surface)]">${accountInfo.balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex items-center gap-2 text-[var(--primary-tv)] opacity-80">
                    <Zap size={12} />
                    <span>Equity:</span>
                    <span className="text-[var(--on-surface)]">${accountInfo.equity.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                </div>
                <div className="flex items-center gap-2 text-emerald-400">
                    <TrendingUp size={12} />
                    <span>Profit:</span>
                    <span className={`font-black ${accountInfo.profit >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                        ${accountInfo.profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                </div>
                <div className="ml-auto text-[var(--on-surface-variant)] opacity-60">
                    Leverage: <span className="text-[var(--on-surface)]">1:{accountInfo.leverage}</span>
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex items-center bg-[var(--surface-dim)] border-b border-[var(--border-ghost)]">
                <TabButton id="positions" label="Posiciones Abiertas" count={positions.length} />
                <TabButton id="orders" label="Órdenes Pendientes" count={pendingOrders.length} />
                <TabButton id="history" label="Historial de Trading" count={positionHistory.length} />
            </div>

            {/* Table Content */}
            <div className="flex-1 overflow-y-auto custom-scrollbar">
                <table className="w-full text-left text-[10px] border-collapse">
                    <thead className="sticky top-0 bg-[var(--surface-dim)] text-[var(--on-surface-variant)] font-medium uppercase border-b border-[var(--border-ghost)] shadow-sm">
                        <tr>
                            <th className="px-4 py-2 font-medium">Ticket</th>
                            <th className="px-4 py-2 font-medium">Symbol</th>
                            <th className="px-4 py-2 font-medium">Side</th>
                            <th className="px-4 py-2 font-medium">Volume</th>
                            <th className="px-4 py-2 font-medium">Price</th>
                            {activeTab === 'history' ? (
                                <>
                                    <th className="px-4 py-2 font-medium text-right">Profit (USD)</th>
                                    <th className="px-4 py-2 font-medium text-right">Time</th>
                                </>
                            ) : (
                                <>
                                    <th className="px-4 py-2 font-medium">SL</th>
                                    <th className="px-4 py-2 font-medium">TP</th>
                                    <th className="px-4 py-2 font-medium text-right">P&L (USD)</th>
                                    <th className="px-4 py-2 w-10 text-center"></th>
                                </>
                            )}
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border-ghost)]">
                        {activeTab === 'positions' && (
                            positions.length === 0 ? (
                                <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-600 italic">No hay posiciones abiertas</td></tr>
                            ) : (
                                positions.map((pos) => (
                                    <tr key={pos.ticket} className="hover:bg-[var(--surface-high)] transition-colors group">
                                        <td className="px-4 py-2 font-mono text-[var(--on-surface-variant)]">#{pos.ticket}</td>
                                        <td className="px-4 py-2 font-bold text-[var(--on-surface)]">{pos.symbol}</td>
                                        <td className="px-4 py-2"><SideBadge type={pos.type} /></td>
                                        <td className="px-4 py-2 font-mono">{pos.volume.toFixed(2)}</td>
                                        <td className="px-4 py-2 font-mono opacity-80">{pos.price_open.toFixed(2)}</td>
                                        <td className="px-4 py-2 font-mono text-[var(--success)]/80">{pos.sl > 0 ? pos.sl.toFixed(2) : '-'}</td>
                                        <td className="px-4 py-2 font-mono text-[var(--danger)]/80">{pos.tp > 0 ? pos.tp.toFixed(2) : '-'}</td>
                                        <td className={`px-4 py-2 font-black text-right font-mono ${pos.profit >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                            {pos.profit >= 0 ? '+' : ''}{pos.profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-4 py-2 text-center">
                                            <button onClick={() => closeTradingPosition(pos.ticket)} className="p-1 hover:bg-[var(--danger)] hover:text-white rounded-md transition-all opacity-0 group-hover:opacity-100"><X size={14} /></button>
                                        </td>
                                    </tr>
                                ))
                            )
                        )}

                        {activeTab === 'orders' && (
                            pendingOrders.length === 0 ? (
                                <tr><td colSpan={9} className="px-4 py-10 text-center text-gray-600 italic">No hay órdenes pendientes</td></tr>
                            ) : (
                                pendingOrders.map((ord) => (
                                    <tr key={ord.ticket} className="hover:bg-[var(--surface-high)] transition-colors group">
                                        <td className="px-4 py-2 font-mono text-[var(--on-surface-variant)]">#{ord.ticket}</td>
                                        <td className="px-4 py-2 font-bold text-[var(--on-surface)]">{ord.symbol}</td>
                                        <td className="px-4 py-2"><SideBadge type={ord.type} /></td>
                                        <td className="px-4 py-2 font-mono">{ord.volume.toFixed(2)}</td>
                                        <td className="px-4 py-2 font-mono opacity-80">{ord.price_open.toFixed(2)}</td>
                                        <td className="px-4 py-2 font-mono text-[var(--success)]/80">{ord.sl > 0 ? ord.sl.toFixed(2) : '-'}</td>
                                        <td className="px-4 py-2 font-mono text-[var(--danger)]/80">{ord.tp > 0 ? ord.tp.toFixed(2) : '-'}</td>
                                        <td className="px-4 py-2 font-black text-right font-mono text-[var(--on-surface-variant)] opacity-40">-</td>
                                        <td className="px-4 py-2 text-center">
                                            <button onClick={() => closeTradingPosition(ord.ticket)} className="p-1 hover:bg-[var(--danger)] hover:text-white rounded-md transition-all opacity-0 group-hover:opacity-100"><X size={14} /></button>
                                        </td>
                                    </tr>
                                ))
                            )
                        )}

                        {activeTab === 'history' && (
                            positionHistory.length === 0 ? (
                                <tr><td colSpan={7} className="px-4 py-10 text-center text-gray-600 italic">No hay historial disponible</td></tr>
                            ) : (
                                positionHistory.map((h: any, i: number) => (
                                    <tr key={`${h.ticket}_${i}`} className="hover:bg-[var(--surface-high)] transition-colors">
                                        <td className="px-4 py-2 font-mono text-[var(--on-surface-variant)]">#{h.ticket}</td>
                                        <td className="px-4 py-2 font-bold text-[var(--on-surface)]">{h.symbol}</td>
                                        <td className="px-4 py-2"><SideBadge type={h.type} /></td>
                                        <td className="px-4 py-2 font-mono">{h.volume.toFixed(2)}</td>
                                        <td className="px-4 py-2 font-mono opacity-80">{h.price.toFixed(2)}</td>
                                        <td className={`px-4 py-2 font-black text-right font-mono ${h.profit >= 0 ? 'text-[var(--success)]' : 'text-[var(--danger)]'}`}>
                                            {h.profit >= 0 ? '+' : ''}{h.profit.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                        </td>
                                        <td className="px-4 py-2 text-right font-mono opacity-60">
                                            {new Date(h.time * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </td>
                                    </tr>
                                ))
                            )
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
};

const SideBadge = ({ type }: { type: string }) => (
    <span className={`px-1.5 py-0.5 rounded-[3px] font-black text-[9px] ${
        type.includes('BUY') 
        ? 'bg-[var(--success)]/10 text-[var(--success)] border border-[var(--success)]/20' 
        : 'bg-[var(--danger)]/10 text-[var(--danger)] border border-[var(--danger)]/20'
    }`}>
        {type}
    </span>
);

export default PositionsPanel;

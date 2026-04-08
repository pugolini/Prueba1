import React from 'react';
import { useStore } from '../../store/useStore';
import { ChevronDown, BarChart3, Activity, Settings, Maximize2, CandlestickChart, FileCode } from 'lucide-react';
import { executeVortexJS } from '../../engine/vortexEngine';

const TopToolbar: React.FC = () => {
  const { 
    symbol, 
    timeframe, 
    setTimeframe, 
    indicators, 
    toggleIndicator,
    isOrderTicketOpen, 
    setOrderTicketOpen,
    setSymbolSearchOpen,
    isFootprintEnabled,
    setFootprintEnabled,
    savedScripts,
    pineIndicators,
    addPineIndicator,
    removePineIndicator,
    data,
    serverOffset,
    theme,
    setPineCode,
    setPineEditorOpen,
    activePlatform,
    setActivePlatform,
    setSettingsOpen
  } = useStore();
  
  const tfList = ['1m', '5m', '15m', '30m', '1h', '4h', '1d'];

  const handleEditIndicator = (name: string, defaultCode?: string) => {
    const script = savedScripts.find(s => s.name === name);
    const code = script ? script.code : defaultCode;
    
    if (code) {
      setPineCode(code);
      setPineEditorOpen(true);
    }
  };

  const handleToggleScript = (script: { id: string, name: string, code: string }) => {
    // Check if script is already active by looking for its code/id in pineIndicators
    const activeInstance = pineIndicators.find(p => p.script === script.code);
    
    if (activeInstance) {
      removePineIndicator(activeInstance.id);
    } else {
      // Execute script on current data
      const results = executeVortexJS(script.code, data, serverOffset, theme);
      addPineIndicator(script.code, results);
    }
  };

  return (
    <div className="topbar-tv">
      {/* Asset Selector */}
      <button 
        className="topbar-item bg-surface-high font-bold text-white px-3 flex items-center gap-2 hover:bg-[#2a2e39] transition-colors"
        style={{backgroundColor: 'var(--surface-high)'}}
        onClick={() => setSymbolSearchOpen(true)}
      >
        <span className="text-blue-500 bg-blue-500/10 p-1 rounded">
          <ChevronDown size={14} />
        </span>
        {symbol.split('.')[0]}
      </button>

      <div className="topbar-divider" />
      
      {/* Timeframes */}
      <div className="flex-row-tv gap-05-tv">
        {tfList.map(tf => (
          <button
            key={tf}
            className={`topbar-item min-w-[32px] justify-center ${timeframe === tf ? 'active' : ''}`}
            onClick={() => setTimeframe(tf)}
          >
            {tf.toUpperCase().replace('1D', 'D').replace('M', '')}
          </button>
        ))}
      </div>

      {/* Platform Selector (Hybrid Bridge) */}
      <div className="flex bg-[#2a2e39]/50 rounded-md p-0.5 ml-3 border border-[#363a45] shadow-inner h-[28px] items-center">
        <button 
          className={`px-2.5 h-full text-[10px] font-black rounded transition-all duration-300 flex items-center gap-1.5 ${
            activePlatform === 'MT5' 
            ? 'bg-[#2962ff] text-white shadow-[0_0_15px_rgba(41,98,255,0.4)]' 
            : 'text-[#787b86] hover:text-[#d1d4dc]'
          }`}
          onClick={() => setActivePlatform('MT5')}
          title="Modo MetaTrader 5 (Datos + Trading)"
        >
          <div className={`w-1.5 h-1.5 rounded-full ${activePlatform === 'MT5' ? 'bg-white animate-pulse' : 'bg-[#787b86]'}`} />
          MT5
        </button>
        <button 
          className={`px-2.5 h-full text-[10px] font-black rounded transition-all duration-300 flex items-center gap-1.5 ${
            activePlatform === 'MT4' 
            ? 'bg-[#ff9800] text-white shadow-[0_0_15px_rgba(255,152,0,0.4)]' 
            : 'text-[#787b86] hover:text-[#d1d4dc]'
          }`}
          onClick={() => setActivePlatform('MT4')}
          title="Modo MetaTrader 4 (Híbrido: Datos MT5 + Trading MT4)"
        >
          <div className={`w-1.5 h-1.5 rounded-full ${activePlatform === 'MT4' ? 'bg-white animate-pulse' : 'bg-[#787b86]'}`} />
          MT4
        </button>
      </div>

      {/* Rithmic Status Indicator */}
      <div 
        className="flex items-center gap-2 px-2.5 h-[28px] bg-[#1e222d] border border-[#363a45] rounded-md ml-2 cursor-pointer hover:bg-[#2a2e39] transition-colors"
        onClick={() => setSettingsOpen(true)}
        title="Rithmic/Apex Status - Click para configurar"
      >
        <div className={`w-2 h-2 rounded-full ${useStore.getState().rithmicConfig.connected ? 'bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]' : 'bg-orange-500'}`} />
        <span className="text-[10px] font-bold text-[#d1d4dc]">RITHMIC</span>
      </div>

      <div className="topbar-divider" />

      {/* Indicators Dropdown (TV Style) */}
      <div className="relative group flex h-full">
        <button 
          className="topbar-item flex items-center gap-1.5 hover:bg-[#2a2e39] transition-colors h-full px-2"
          title="Indicadores"
        >
          <Activity size={16} className="text-[#787b86]" />
          <span className="text-[13px] font-medium text-[#d1d4dc] hidden md:inline">Indicadores</span>
          <ChevronDown size={14} className="text-[#787b86] ml-0.5" />
        </button>
        
        {/* Dropdown Menu */}
        <div className="absolute top-full left-0 mt-0 w-56 bg-[#1e222d] border border-[#363a45] rounded shadow-2xl py-1 hidden group-hover:block z-[100] max-h-[70vh] overflow-y-auto custom-scrollbar">
          {/* Core Indicators */}
          <div className="px-3 py-1 text-[10px] font-bold text-[#787b86] uppercase tracking-wider">Básicos</div>
          <div className="flex items-center group/item hover:bg-[#2a2e39]">
            <button 
              className={`flex-1 text-left px-4 py-2 text-[13px] flex items-center justify-between ${indicators.sma20 ? 'text-[#2962ff]' : 'text-[#d1d4dc]'}`}
              onClick={() => toggleIndicator('sma20')}
            >
              <span>SMA 20</span>
              {indicators.sma20 && <div className="w-1.5 h-1.5 rounded-full bg-[#2962ff]" />}
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); handleEditIndicator('SMA 20', '// SMA 20\\nconst sma = ta.sma(close, 20);\\nplot(sma, { color: "#2962ff", title: "SMA 20" });'); }}
              className="px-3 text-[#787b86] hover:text-white transition-colors"
              title="Ver Código"
            >
              <FileCode size={14} />
            </button>
          </div>
          
          <div className="flex items-center group/item hover:bg-[#2a2e39]">
            <button 
              className={`flex-1 text-left px-4 py-2 text-[13px] flex items-center justify-between ${indicators.ema50 ? 'text-[#2962ff]' : 'text-[#d1d4dc]'}`}
              onClick={() => toggleIndicator('ema50')}
            >
              <span>EMA 50</span>
              {indicators.ema50 && <div className="w-1.5 h-1.5 rounded-full bg-[#2962ff]" />}
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); handleEditIndicator('EMA 50', '// EMA 50\\nconst ema = ta.ema(close, 50);\\nplot(ema, { color: "#ff9800", title: "EMA 50" });'); }}
              className="px-3 text-[#787b86] hover:text-white transition-colors"
              title="Ver Código"
            >
              <FileCode size={14} />
            </button>
          </div>

          <div className="flex items-center group/item hover:bg-[#2a2e39]">
            <button 
              className={`flex-1 text-left px-4 py-2 text-[13px] flex items-center justify-between ${indicators.vwap ? 'text-[#2962ff]' : 'text-[#d1d4dc]'}`}
              onClick={() => toggleIndicator('vwap')}
            >
              <span>VWAP</span>
              {indicators.vwap && <div className="w-1.5 h-1.5 rounded-full bg-[#2962ff]" />}
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); handleEditIndicator('VWAP', '// VWAP\\nconst [vwap] = ta.vwap_session(close, volume);\\nplot(vwap, { color: "#089981", title: "VWAP" });'); }}
              className="px-3 text-[#787b86] hover:text-white transition-colors"
              title="Ver Código"
            >
              <FileCode size={14} />
            </button>
          </div>

          <div className="h-[1px] bg-[#363a45] my-1 opacity-50" />
          
          {/* Vortex Library */}
          <div className="px-3 py-1 text-[10px] font-bold text-[#787b86] uppercase tracking-wider">Biblioteca Vortex</div>
          {savedScripts.length === 0 ? (
            <div className="px-4 py-2 text-[11px] text-gray-500 italic">No hay scripts guardados</div>
          ) : (
            savedScripts.map(script => {
              const isActive = pineIndicators.some(p => p.script === script.code);
              return (
                <div key={script.id} className="flex items-center group/item hover:bg-[#2a2e39]">
                  <button 
                    className={`flex-1 text-left px-4 py-2 text-[13px] flex items-center justify-between ${isActive ? 'text-blue-400 font-bold' : 'text-[#d1d4dc]'}`}
                    onClick={() => handleToggleScript(script)}
                  >
                    <span className="truncate pr-2">{script.name}</span>
                    {isActive && <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shadow-[0_0_5px_rgba(96,165,250,0.5)]" />}
                  </button>
                  <button 
                    onClick={(e) => { e.stopPropagation(); handleEditIndicator(script.name, script.code); }}
                    className="px-3 text-[#787b86] hover:text-white transition-colors"
                    title="Editar Código"
                  >
                    <FileCode size={14} />
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>

      <div className="topbar-divider" />

      {/* Strategies Dropdown */}
      <div className="relative group flex h-full">
        <button 
          className="topbar-item flex items-center gap-1.5 hover:bg-[#2a2e39] transition-colors h-full px-2"
          title="Estrategias Order Flow"
        >
          <Activity size={16} className="text-orange-500" />
          <span className="text-[13px] font-medium text-[#d1d4dc] hidden md:inline">Estrategias</span>
          <ChevronDown size={14} className="text-[#787b86] ml-0.5" />
        </button>
        
        {/* Dropdown Menu */}
        <div className="absolute top-full left-0 mt-0 w-64 bg-[#1e222d] border border-[#363a45] rounded shadow-2xl py-1 hidden group-hover:block z-[100]">
          <div className="px-3 py-1 text-[10px] font-bold text-[#787b86] uppercase tracking-wider">Order Flow Pro</div>
          
          <button 
            className={`w-full text-left px-4 py-2 text-[12px] hover:bg-[#2a2e39] flex items-center justify-between ${useStore.getState().orderFlowStrategies.deltaDifferential ? 'text-blue-400 font-bold' : 'text-[#d1d4dc]'}`}
            onClick={() => useStore.getState().toggleStrategy('deltaDifferential')}
          >
            <span>E1: Diferencial de Delta</span>
            {useStore.getState().orderFlowStrategies.deltaDifferential && <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
          </button>

          <button 
            className={`w-full text-left px-4 py-2 text-[12px] hover:bg-[#2a2e39] flex items-center justify-between ${useStore.getState().orderFlowStrategies.doubleDelta ? 'text-blue-400 font-bold' : 'text-[#d1d4dc]'}`}
            onClick={() => useStore.getState().toggleStrategy('doubleDelta')}
          >
            <span>E2: La Doble Delta</span>
            {useStore.getState().orderFlowStrategies.doubleDelta && <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
          </button>

          <button 
            className={`w-full text-left px-4 py-2 text-[12px] hover:bg-[#2a2e39] flex items-center justify-between ${useStore.getState().orderFlowStrategies.macroContext ? 'text-blue-400 font-bold' : 'text-[#d1d4dc]'}`}
            onClick={() => useStore.getState().toggleStrategy('macroContext')}
          >
            <span>E3: Contexto Macro (H4/D1)</span>
            {useStore.getState().orderFlowStrategies.macroContext && <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
          </button>

          <button 
            className={`w-full text-left px-4 py-2 text-[12px] hover:bg-[#2a2e39] flex items-center justify-between ${useStore.getState().orderFlowStrategies.postNews ? 'text-blue-400 font-bold' : 'text-[#d1d4dc]'}`}
            onClick={() => useStore.getState().toggleStrategy('postNews')}
          >
            <span>E4: Post-Noticia (Caza Liq)</span>
            {useStore.getState().orderFlowStrategies.postNews && <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
          </button>

          <button 
            className={`w-full text-left px-4 py-2 text-[12px] hover:bg-[#2a2e39] flex items-center justify-between ${useStore.getState().orderFlowStrategies.volumeProfile ? 'text-blue-400 font-bold' : 'text-[#d1d4dc]'}`}
            onClick={() => useStore.getState().toggleStrategy('volumeProfile')}
          >
            <span>E5: Volume Profile Estructural</span>
            {useStore.getState().orderFlowStrategies.volumeProfile && <div className="w-1.5 h-1.5 rounded-full bg-blue-400" />}
          </button>

          <div className="h-[1px] bg-[#363a45] my-1 opacity-50" />
          <div className="px-3 py-1 text-[10px] font-bold text-orange-500 uppercase tracking-wider">Rithmic / Apex Data</div>

          <button 
            className={`w-full text-left px-4 py-2 text-[12px] hover:bg-[#2a2e39] flex items-center justify-between ${useStore.getState().orderFlowStrategies.bigTrades ? 'text-orange-400 font-bold' : 'text-[#d1d4dc]'}`}
            onClick={() => useStore.getState().toggleStrategy('bigTrades')}
          >
            <span>Big Trades (Burbujas)</span>
            {useStore.getState().orderFlowStrategies.bigTrades && <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />}
          </button>

          <button 
            className={`w-full text-left px-4 py-2 text-[12px] hover:bg-[#2a2e39] flex items-center justify-between ${useStore.getState().orderFlowStrategies.bookmap ? 'text-orange-400 font-bold' : 'text-[#d1d4dc]'}`}
            onClick={() => useStore.getState().toggleStrategy('bookmap')}
          >
            <span>Bookmap Heatmap</span>
            {useStore.getState().orderFlowStrategies.bookmap && <div className="w-1.5 h-1.5 rounded-full bg-orange-400" />}
          </button>
        </div>
      </div>

      {/* Chart Types Dropdown (TV Style) */}
      <div className="relative group flex h-full">
        <button 
          className="topbar-item flex items-center gap-1 hover:bg-[#2a2e39] transition-colors h-full px-2"
          title="Tipo de Vela"
        >
          {isFootprintEnabled ? <BarChart3 size={16} className="text-[#2962ff]" /> : <CandlestickChart size={16} className="text-[#787b86]" />}
          <ChevronDown size={14} className="text-[#787b86] ml-0.5" />
        </button>

        {/* Dropdown Menu */}
        <div className="absolute top-full left-0 mt-0 w-44 bg-[#1e222d] border border-[#363a45] rounded shadow-2xl py-1 hidden group-hover:block z-[100]">
          <button 
            className={`w-full text-left px-4 py-2 text-[12px] hover:bg-[#2a2e39] flex items-center justify-between ${!isFootprintEnabled ? 'text-[#2962ff] font-bold' : 'text-[#d1d4dc]'}`}
            onClick={() => setFootprintEnabled(false)}
          >
            Velas Japonesas
            {!isFootprintEnabled && <div className="w-1 h-3 bg-[#2962ff] rounded-sm" />}
          </button>
          <button 
            className={`w-full text-left px-4 py-2 text-[12px] hover:bg-[#2a2e39] flex items-center justify-between ${isFootprintEnabled ? 'text-[#2962ff] font-bold' : 'text-[#d1d4dc]'}`}
            onClick={() => setFootprintEnabled(true)}
          >
            Footprint Chart
            {isFootprintEnabled && <div className="w-1 h-3 bg-[#2962ff] rounded-sm" />}
          </button>
        </div>
      </div>

      <div className="flex-1" />

      {/* Right Tools */}
      <div className="flex items-center gap-3">
        <button 
          className="tv-button-primary"
          onClick={() => setOrderTicketOpen(!isOrderTicketOpen)}
        >
          NEGOCIE
        </button>
        <div className="topbar-divider" />
        <Settings 
          size={18} 
          className="text-on-surface-variant cursor-pointer hover:text-white transition-colors" 
          onClick={() => setSettingsOpen(true)}
        />
        <Maximize2 size={18} className="text-on-surface-variant cursor-pointer hover:text-white transition-colors" />
      </div>
    </div>
  );
};

export default TopToolbar;

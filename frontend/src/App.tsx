import React, { useEffect } from 'react';
import Sidebar from './components/Sidebar/Sidebar';
import TopToolbar from './components/Chart/TopToolbar';
import ChartComponent from './components/Chart/ChartComponent';
import BottomBar from './components/Chart/BottomBar';
import Watchlist from './components/Sidebar/Watchlist';
import SymbolSearchModal from './components/Modals/SymbolSearchModal';
import SettingsModal from './components/Modals/SettingsModal';
import OrderTicket from './components/Sidebar/OrderTicket';
import PineEditor from './components/PineEditor/PineEditor';
import PositionsPanel from './components/Chart/PositionsPanel';
import { useStore } from './store/useStore';


function App() {
  const { isSymbolSearchOpen, isOrderTicketOpen, theme, isPineEditorOpen } = useStore();
  const [bottomPanelHeight, setBottomPanelHeight] = React.useState(200);
  const [isResizing, setIsResizing] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  // Apply theme to document
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, [theme]);

  // Resize Handling
  const startResizing = () => setIsResizing(true);
  
  const stopResizing = React.useCallback(() => {
    setIsResizing(false);
    // 🔄 Sync React state only when finished to ensure persistence
    if (containerRef.current) {
      const currentH = parseInt(containerRef.current.style.getPropertyValue('--bottom-panel-h'));
      if (!isNaN(currentH)) setBottomPanelHeight(currentH);
    }
  }, []);

  const resize = React.useCallback((e: MouseEvent) => {
    if (isResizing && containerRef.current) {
      const newHeight = window.innerHeight - e.clientY - 36; // 36 is bottombar-h
      if (newHeight > 60 && newHeight < window.innerHeight * 0.7) {
        // 🚀 HIGH PERFORMANCE: Direct CSS Variable update (Bypass React)
        containerRef.current.style.setProperty('--bottom-panel-h', `${newHeight}px`);
        
        // 📡 Notify Chart to resize immediately (avoid black flicker)
        window.dispatchEvent(new Event('resize-chart'));
      }
    }
  }, [isResizing]);

  useEffect(() => {
    window.addEventListener('mousemove', resize);
    window.addEventListener('mouseup', stopResizing);
    return () => {
      window.removeEventListener('mousemove', resize);
      window.removeEventListener('mouseup', stopResizing);
    };
  }, [resize, stopResizing]);

  return (
    <div 
      ref={containerRef}
      className="terminal-container" 
      style={{ '--bottom-panel-h': `${bottomPanelHeight}px` } as React.CSSProperties}
    >
      <Sidebar />
      <TopToolbar />
      <main className="chart-area flex flex-col overflow-hidden relative">
        <ChartComponent />
        
        {/* Resize Handle */}
        <div 
          onMouseDown={startResizing}
          className="absolute bottom-0 left-0 right-0 h-[3px] bg-transparent hover:bg-[var(--primary-tv)]/50 cursor-ns-resize z-[60] transition-colors"
          title="Arrastrar para redimensionar panel inferior"
        />
      </main>

      <PositionsPanel />
      
      {isPineEditorOpen && <PineEditor />}
      
      <BottomBar />
      <aside className="rightbar-tv">
        {isOrderTicketOpen ? <OrderTicket /> : <Watchlist />}
      </aside>

      {/* Overlays */}
      {isSymbolSearchOpen && <SymbolSearchModal />}
      <SettingsModal />
    </div>
  );
}


export default App;

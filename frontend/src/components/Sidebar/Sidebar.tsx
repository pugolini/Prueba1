import React from 'react';
import { useStore } from '../../store/useStore';
import {
  Plus, Search, TrendingUp, Maximize2, Square,
  Type, Eraser, MousePointer2, Settings,
  ChevronDown, Layers, BarChart3, Clock3,
  Sun, Moon, Anchor, Sigma, Calculator
} from 'lucide-react';

const Sidebar: React.FC = () => {
  const { activeTool, setActiveTool, theme, toggleTheme } = useStore();

  return (
    <div className="sidebar-tv">
      <div
        className={`sidebar-icon ${activeTool === 'cursor' ? 'active' : ''}`}
        onClick={() => setActiveTool('cursor')}
      >
        <MousePointer2 size={18} strokeWidth={1.5} />
      </div>

      <div
        className={`sidebar-icon ${activeTool === 'trendline' ? 'active' : ''}`}
        onClick={() => setActiveTool('trendline')}
      >
        <TrendingUp size={18} strokeWidth={1.5} />
      </div>

      <div
        className={`sidebar-icon ${activeTool === 'anchoredVwap' ? 'active' : ''}`}
        onClick={() => setActiveTool('anchoredVwap')}
        title="Anchored VWAP"
      >
        <Anchor size={18} strokeWidth={1.5} />
      </div>
      {/* Drawing Tools Icons */}
      <div className="flex flex-col gap-4 items-center">
        <div
          className={`sidebar-icon ${activeTool === 'rectangle' ? 'active' : ''}`}
          title="Herramienta Rectángulo"
          onClick={() => setActiveTool('rectangle')}
        >
          <Square size={18} strokeWidth={1.5} />
        </div>
        <div
          className={`sidebar-icon ${activeTool === 'brush' ? 'active' : ''}`}
          title="Pincel"
          onClick={() => setActiveTool('brush')}
        >
          <Type size={18} strokeWidth={1.5} />
        </div>
        <div
          className={`sidebar-icon ${activeTool === 'fibonacci' ? 'active' : ''}`}
          title="Retroceso de Fibonacci"
          onClick={() => setActiveTool('fibonacci')}
        >
          <Sigma size={18} strokeWidth={1.5} />
        </div>
        <div
          className={`sidebar-icon ${activeTool === 'long' ? 'active' : ''}`}
          title="Posición Larga"
          onClick={() => setActiveTool('long')}
        >
          <Calculator size={18} strokeWidth={1.5} className="text-green-500" />
        </div>
        <div
          className={`sidebar-icon ${activeTool === 'short' ? 'active' : ''}`}
          title="Posición Corta"
          onClick={() => setActiveTool('short')}
        >
          <Calculator size={18} strokeWidth={1.5} className="text-red-500" />
        </div>
        <div
          className={`sidebar-icon ${activeTool === 'text' ? 'active' : ''}`}
          title="Texto"
          onClick={() => setActiveTool('text')}
        >
            <Layers size={18} strokeWidth={1.5} />
        </div>
      </div>

      <div className="mt-auto pb-4 flex flex-col gap-4 items-center">
        {/* Theme Toggle */}
        <button
          className="sidebar-icon p-2 rounded-md text-on-surface-variant hover:text-white transition-colors"
          title={theme === 'dark' ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
          onClick={toggleTheme}
        >
          {theme === 'dark' ? <Sun size={18} strokeWidth={1.5} /> : <Moon size={18} strokeWidth={1.5} />}
        </button>
        <button className="sidebar-icon p-2 rounded-md text-on-surface-variant hover:text-white transition-colors" title="Configuración">
          <Settings size={18} strokeWidth={1.5} />
        </button>
      </div>
    </div>
  );
};


export default Sidebar;

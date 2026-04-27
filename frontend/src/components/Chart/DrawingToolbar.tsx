import React, { useState } from 'react';
import { 
  Type, 
  Trash2, 
  Lock, 
  Unlock, 
  Settings, 
  Bell, 
  Palette, 
  Minus,
  MoreHorizontal,
  Square,
  MoveRight
} from 'lucide-react';
import { useStore } from '../../store/useStore';

export const DrawingToolbar: React.FC = () => {
    const { 
        selectedDrawingId, 
        drawingsBySymbol, 
        symbol, 
        updateDrawing, 
        removeDrawing, 
        setSelectedDrawingId 
    } = useStore();
    
    const [isColorOpen, setIsColorOpen] = useState(false);
    const [isFillColorOpen, setIsFillColorOpen] = useState(false);
    const [isOpacityOpen, setIsOpacityOpen] = useState(false);
    const [isThicknessOpen, setIsThicknessOpen] = useState(false);
    const [isStyleOpen, setIsStyleOpen] = useState(false);
    const [isTextOpen, setIsTextOpen] = useState(false);
    const [isTextColorOpen, setIsTextColorOpen] = useState(false);

    const drawing = (drawingsBySymbol[symbol] || []).find(d => d.id === selectedDrawingId);

    if (!selectedDrawingId || !drawing) return null;

    const colors = ['#2962ff', '#f44336', '#4caf50', '#ffeb3b', '#9c27b0', '#ff9800', '#ffffff', '#000000', 'transparent'];
    const thicknesses = [0, 1, 2, 3, 4];
    const styles = [
        { label: 'Sólida', value: 0 },
        { label: 'Puntos', value: 1 },
        { label: 'Guiones', value: 2 },
    ];

    return (
        <div 
            className="absolute top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-1 p-1.5 bg-[#1e222d]/90 backdrop-blur-md border border-[#363a45] rounded-lg shadow-2xl animate-in fade-in slide-in-from-top-2 duration-200"
            onClick={(e) => e.stopPropagation()}
        >
            {/* Tipo de Herramienta */}
            <div className="px-3 py-1.5 border-r border-[#363a45] flex items-center gap-2">
                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-wider">{drawing.type}</span>
            </div>

            {/* Color Picker (Borde) */}
            <div className="relative">
                <button 
                    onClick={() => setIsColorOpen(!isColorOpen)}
                    className="p-2 hover:bg-[#2a2e39] rounded transition-colors group"
                    title="Color del Borde"
                >
                    <div 
                        className="w-5 h-5 rounded-full border border-white/20 shadow-sm" 
                        style={{ backgroundColor: drawing.color }}
                    />
                </button>
                {isColorOpen && (
                    <div className="absolute top-full left-0 mt-2 p-2 bg-[#1e222d] border border-[#363a45] rounded-lg shadow-xl grid grid-cols-5 gap-2 z-[60]">
                        {colors.map(c => (
                            <button 
                                key={c}
                                onClick={() => {
                                    updateDrawing(drawing.id, { color: c });
                                    setIsColorOpen(false);
                                }}
                                className="w-6 h-6 rounded-full hover:scale-110 transition-transform border border-white/10 relative overflow-hidden"
                                style={{ backgroundColor: c === 'transparent' ? '#1a1c22' : c }}
                            >
                                {c === 'transparent' && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-[1px] h-full bg-red-500 rotate-45" />
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Color de Relleno (Solo Rectángulos) */}
            {drawing.type === 'rectangle' && (
                <>
                    <div className="relative">
                        <button 
                            onClick={() => setIsFillColorOpen(!isFillColorOpen)}
                            className="p-2 hover:bg-[#2a2e39] rounded transition-colors group flex items-center justify-center"
                            title="Color de Fondo"
                        >
                            <Square 
                                size={18} 
                                fill={drawing.fillColor || drawing.color} 
                                style={{ color: drawing.fillColor || drawing.color, opacity: drawing.fillOpacity ?? 0.1 }} 
                            />
                        </button>
                        {isFillColorOpen && (
                            <div className="absolute top-full left-0 mt-2 p-2 bg-[#1e222d] border border-[#363a45] rounded-lg shadow-xl grid grid-cols-5 gap-2 z-[60]">
                                {colors.map(c => (
                                    <button 
                                        key={c}
                                        onClick={() => {
                                            updateDrawing(drawing.id, { fillColor: c });
                                            setIsFillColorOpen(false);
                                        }}
                                        className="w-6 h-6 rounded-full hover:scale-110 transition-transform border border-white/10 relative overflow-hidden"
                                        style={{ backgroundColor: c === 'transparent' ? '#1a1c22' : c }}
                                    >
                                        {c === 'transparent' && (
                                            <div className="absolute inset-0 flex items-center justify-center">
                                                <div className="w-[1px] h-full bg-red-500 rotate-45" />
                                            </div>
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="relative">
                        <button 
                            onClick={() => setIsOpacityOpen(!isOpacityOpen)}
                            className="flex items-center gap-1 px-2 py-1.5 hover:bg-[#2a2e39] rounded transition-colors text-gray-300 text-[10px] font-bold"
                            title="Opacidad del Fondo"
                        >
                            {Math.round((drawing.fillOpacity ?? 0.1) * 100)}%
                        </button>
                        {isOpacityOpen && (
                            <div className="absolute top-full left-0 mt-2 p-3 bg-[#1e222d] border border-[#363a45] rounded-lg shadow-xl min-w-[120px] z-[60]">
                                <div className="text-[9px] uppercase text-gray-500 mb-2 font-bold">Opacidad</div>
                                <input 
                                    type="range"
                                    min="0"
                                    max="1"
                                    step="0.05"
                                    value={drawing.fillOpacity ?? 0.1}
                                    onChange={(e) => updateDrawing(drawing.id, { fillOpacity: parseFloat(e.target.value) })}
                                    className="w-full accent-blue-500 cursor-pointer"
                                />
                            </div>
                        )}
                    </div>

                    <button 
                        onClick={() => updateDrawing(drawing.id, { extendRight: !drawing.extendRight })}
                        className={`p-2 rounded transition-colors ${drawing.extendRight ? 'bg-blue-500/20 text-blue-400' : 'hover:bg-[#2a2e39] text-gray-300'}`}
                        title="Extender a la derecha"
                    >
                        <MoveRight size={18} />
                    </button>
                </>
            )}

            {/* Color de Texto */}
            <div className="relative">
                <button 
                    onClick={() => setIsTextColorOpen(!isTextColorOpen)}
                    className="p-2 hover:bg-[#2a2e39] rounded transition-colors group"
                    title="Color de Texto"
                >
                    <Palette size={18} style={{ color: drawing.textColor || drawing.color }} />
                </button>
                {isTextColorOpen && (
                    <div className="absolute top-full left-0 mt-2 p-2 bg-[#1e222d] border border-[#363a45] rounded-lg shadow-xl grid grid-cols-5 gap-2 z-[60]">
                        {colors.map(c => (
                            <button 
                                key={c}
                                onClick={() => {
                                    updateDrawing(drawing.id, { textColor: c });
                                    setIsTextColorOpen(false);
                                }}
                                className="w-6 h-6 rounded-full hover:scale-110 transition-transform border border-white/10 relative overflow-hidden"
                                style={{ backgroundColor: c === 'transparent' ? '#1a1c22' : c }}
                            >
                                {c === 'transparent' && (
                                    <div className="absolute inset-0 flex items-center justify-center">
                                        <div className="w-[1px] h-full bg-red-500 rotate-45" />
                                    </div>
                                )}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Texto / Etiqueta */}
            <div className="relative">
                <button 
                    className={`p-2 hover:bg-[#2a2e39] rounded transition-colors ${drawing.text ? 'text-blue-400' : 'text-gray-400'}`}
                    title="Configurar Texto"
                    onClick={() => setIsTextOpen(!isTextOpen)}
                >
                    <Type size={20} />
                </button>
                {isTextOpen && (
                    <div className="absolute top-full left-0 mt-2 p-2 bg-[#1e222d] border border-[#363a45] rounded-lg shadow-xl min-w-[200px] flex gap-2">
                        <input 
                            autoFocus
                            type="text"
                            value={drawing.text || ''}
                            onChange={(e) => updateDrawing(drawing.id, { text: e.target.value })}
                            onKeyDown={(e) => { 
                                e.stopPropagation(); // 🛡️ EVITAR QUE EL BORRADO DE TEXTO BORRE LA LÍNEA
                                if (e.key === 'Enter') setIsTextOpen(false); 
                            }}
                            placeholder="Escribe aquí..."
                            className="bg-[#2a2e39] border border-[#363a45] text-white text-xs px-2 py-1 rounded outline-none flex-1"
                        />
                        <button 
                            onClick={() => setIsTextOpen(false)}
                            className="text-[10px] bg-blue-500 hover:bg-blue-600 text-white px-2 py-1 rounded"
                        >
                            OK
                        </button>
                    </div>
                )}
            </div>

            {/* Grosor */}
            <div className="relative">
                <button 
                    onClick={() => setIsThicknessOpen(!isThicknessOpen)}
                    className="flex items-center gap-1 px-2 py-1.5 hover:bg-[#2a2e39] rounded transition-colors text-gray-300 text-xs font-medium"
                    title="Grosor"
                >
                    {drawing.lineWidth}px
                </button>
                {isThicknessOpen && (
                    <div className="absolute top-full left-0 mt-2 p-1 bg-[#1e222d] border border-[#363a45] rounded-lg shadow-xl min-w-[100px] z-[60]">
                        {thicknesses.map(t => (
                            <button 
                                key={t}
                                onClick={() => {
                                    updateDrawing(drawing.id, { lineWidth: t });
                                    setIsThicknessOpen(false);
                                }}
                                className={`w-full px-3 py-1.5 text-left text-xs hover:bg-[#2a2e39] rounded transition-colors flex justify-between items-center ${drawing.lineWidth === t ? 'text-blue-400 bg-[#2a2e39]' : 'text-gray-300'}`}
                            >
                                <span>{t}px</span>
                                {t === 0 && <span className="text-[9px] opacity-50 uppercase">Invisible</span>}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Estilo de Línea */}
            <div className="relative">
                <button 
                    onClick={() => setIsStyleOpen(!isStyleOpen)}
                    className="p-2 hover:bg-[#2a2e39] rounded transition-colors text-gray-300"
                    title="Estilo"
                >
                    <Minus size={20} className={drawing.lineStyle === 1 ? 'opacity-50' : drawing.lineStyle === 2 ? 'stroke-dasharray-2' : ''} />
                </button>
                {isStyleOpen && (
                    <div className="absolute top-full left-0 mt-2 p-1 bg-[#1e222d] border border-[#363a45] rounded-lg shadow-xl min-w-[100px]">
                        {styles.map(s => (
                            <button 
                                key={s.value}
                                onClick={() => {
                                    updateDrawing(drawing.id, { lineStyle: s.value });
                                    setIsStyleOpen(false);
                                }}
                                className={`w-full px-3 py-1.5 text-left text-xs hover:bg-[#2a2e39] rounded transition-colors ${drawing.lineStyle === s.value ? 'text-blue-400 bg-[#2a2e39]' : 'text-gray-300'}`}
                            >
                                {s.label}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            <div className="w-px h-6 bg-[#363a45] mx-1" />

            {/* Alerta (Simulada) */}
            <button className="p-2 hover:bg-[#2a2e39] rounded transition-colors text-gray-400 hover:text-orange-400" title="Añadir Alerta">
                <Bell size={20} />
            </button>

            {/* Bloqueo */}
            <button 
                onClick={() => updateDrawing(drawing.id, { isLocked: !drawing.isLocked })}
                className={`p-2 hover:bg-[#2a2e39] rounded transition-colors ${drawing.isLocked ? 'text-orange-400' : 'text-gray-400'}`}
                title={drawing.isLocked ? 'Desbloquear' : 'Bloquear'}
            >
                {drawing.isLocked ? <Lock size={20} /> : <Unlock size={20} />}
            </button>

            {/* Eliminar */}
            <button 
                onClick={() => {
                    removeDrawing(drawing.id);
                    setSelectedDrawingId(null);
                }}
                className="p-2 hover:bg-red-500/20 rounded transition-colors text-gray-400 hover:text-red-400"
                title="Eliminar"
            >
                <Trash2 size={20} />
            </button>

            <div className="w-px h-6 bg-[#363a45] mx-1" />

            {/* Más Opciones */}
            <button className="p-2 hover:bg-[#2a2e39] rounded transition-colors text-gray-400" title="Más opciones">
                <MoreHorizontal size={20} />
            </button>
        </div>
    );
};

import React, { useState } from 'react';
import { useStore } from '../../store/useStore';
import { executeVortexJS } from '../../engine/vortexEngine';
import { Play, X, ChevronUp, ChevronDown, Save, Trash2 } from 'lucide-react';


const PineEditor: React.FC = () => {
    const { 
        pineCode, setPineCode, data, 
        addPineIndicator, pineIndicators, removePineIndicator,
        savedScripts, addSavedScript, deleteSavedScript,
        isPineEditorOpen: isOpen, setPineEditorOpen: setIsOpen
    } = useStore();
    const [height, setHeight] = useState(400);
    const [isSaving, setIsSaving] = useState(false);
    const [newScriptName, setNewScriptName] = useState("");

    const handleRun = () => {
        if (data.length === 0) return;
        try {
            const results = executeVortexJS(pineCode, data);
            addPineIndicator(pineCode, results);
        } catch (e) {
            console.error("Vortex Run Error:", e);
        }
    };

    const startSave = () => {
        const match = pineCode.match(/indicator\s*\(\s*"(.*?)"/);
        setNewScriptName(match ? match[1] : "Nuevo Script");
        setIsSaving(true);
    };

    const confirmSave = () => {
        if (newScriptName.trim()) {
            addSavedScript(newScriptName.trim(), pineCode);
            setIsSaving(false);
        }
    };

    if (!isOpen) {
        return (
            <div className="fixed bottom-[32px] left-[52px] right-[300px] z-40 px-4">
                <button 
                    onClick={() => setIsOpen(true)}
                    className="flex items-center gap-2 px-4 py-1.5 bg-[#1e222d] hover:bg-[#2a2e39] text-[#c3c5d8] border border-[#2b2e3a] border-b-0 rounded-t-md text-xs font-medium transition-colors shadow-lg"
                >
                    <ChevronUp size={14} />
                    Vortex Editor
                </button>
            </div>
        );
    }

    return (
        <div 
            className="fixed bottom-[32px] left-[52px] right-[300px] z-50 bg-[#1e222d] border-t border-[#2b2e3a] flex flex-col transition-all duration-300 shadow-2xl"
            style={{ height: `${height}px` }}
        >
            {/* Header / Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-[#2b2e3a] bg-[#131722]">
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-[#2962ff] uppercase tracking-wider">Vortex Script</span>
                        <span className="text-[10px] text-[#848e9c]">v1.0 (Native JS)</span>
                    </div>

                    <div className="h-4 w-[1px] bg-[#2b2e3a]" />
                    
                    <div className="flex items-center gap-1">
                        <button 
                            onClick={handleRun}
                            className="flex items-center gap-1.5 px-3 py-1 bg-[#2962ff] hover:bg-[#1e4bd8] text-white rounded text-xs font-semibold transition-all"
                        >
                            <Play size={14} fill="white" />
                            Añadir al Gráfico
                        </button>
                        
                        {isSaving ? (
                            <div className="flex items-center gap-1 bg-[#1e222d] border border-[#2b2e3a] rounded px-1 ml-2 anim-fade-in">
                                <input 
                                    autoFocus
                                    value={newScriptName}
                                    onChange={(e) => setNewScriptName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') confirmSave();
                                        if (e.key === 'Escape') setIsSaving(false);
                                    }}
                                    className="bg-transparent text-[#d1d4dc] text-[11px] px-2 py-1 outline-none w-32 font-medium"
                                    placeholder="Nombre del script"
                                />
                                <button 
                                    onClick={confirmSave}
                                    className="px-2 py-1 text-[#00ff00] hover:bg-[#2a2e39] rounded text-[10px] font-bold uppercase"
                                >
                                    Aceptar
                                </button>
                                <button 
                                    onClick={() => setIsSaving(false)}
                                    className="px-2 py-1 text-[#f23645] hover:bg-[#2a2e39] rounded text-[10px] font-bold uppercase"
                                >
                                    X
                                </button>
                            </div>
                        ) : (
                            <button 
                                onClick={startSave}
                                className="flex items-center gap-1.5 px-3 py-1 bg-[#1e222d] hover:bg-[#2a2e39] text-[#c3c5d8] border border-[#2b2e3a] rounded text-xs font-medium transition-colors"
                            >
                                <Save size={14} />
                                Guardar
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => setIsOpen(false)}
                        className="p-1.5 text-[#848e9c] hover:text-[#c3c5d8] hover:bg-[#2a2e39] rounded transition-colors"
                    >
                        <ChevronDown size={18} />
                    </button>
                </div>
            </div>

            {/* Main Content: Split View */}
            <div className="flex-1 flex overflow-hidden">
                {/* Script Management Sidebar */}
                <div className="w-56 border-r border-[#2b2e3a] bg-[#131722] flex flex-col p-2 gap-4 overflow-y-auto custom-scrollbar">
                    
                    {/* Saved Scripts Section */}
                    <div className="flex flex-col gap-2">
                        <span className="text-[10px] uppercase text-[#5d606b] font-bold px-2 flex items-center justify-between">
                            Biblioteca
                            <span className="text-[9px] bg-[#2a2e39] px-1 rounded">{savedScripts.length}</span>
                        </span>
                        {savedScripts.map((s) => (
                            <div 
                                key={s.id} 
                                onClick={() => setPineCode(s.code)}
                                className="flex items-center justify-between group px-2 py-1.5 hover:bg-[#1e222d] rounded cursor-pointer transition-colors border border-transparent hover:border-[#2b2e3a]"
                            >
                                <span className="text-[11px] text-[#c3c5d8] truncate max-w-[140px]">{s.name}</span>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        e.preventDefault();
                                        console.log("Delete clicked for:", s.name, s.id);
                                        if (window.confirm(`¿Borrar script "${s.name}"?`)) {
                                            deleteSavedScript(s.id);
                                        }
                                    }}
                                    className="opacity-40 group-hover:opacity-100 text-[#f23645] hover:bg-[#2a2e39] p-1 rounded transition-opacity"
                                >
                                    <Trash2 size={12} />
                                </button>
                            </div>
                        ))}
                        {savedScripts.length === 0 && (
                            <span className="text-[10px] text-[#5d606b] px-2 italic">Sin scripts guardados</span>
                        )}
                    </div>

                    <div className="h-[1px] bg-[#2b2e3a] mx-2" />

                    {/* Active Indicators */}
                    <div className="flex flex-col gap-2">
                        <span className="text-[10px] uppercase text-[#5d606b] font-bold px-2 font-mono">En Pantalla</span>
                        {pineIndicators.map((ind) => (
                            <div key={ind.id} className="flex items-center justify-between group px-2 py-1.5 bg-[#1e222d33] border border-[#2b2e3a] rounded cursor-default transition-colors">
                                <span className="text-[11px] text-[#848e9c] truncate">Indicador Activo</span>
                                <button 
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        removePineIndicator(ind.id);
                                    }}
                                    className="text-[#f23645] hover:bg-[#2a2e39] p-1 rounded"
                                >
                                    <X size={12} />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Editor Area */}
                <div className="flex-1 relative bg-[#131722]">
                    <textarea
                        value={pineCode}
                        onChange={(e) => setPineCode(e.target.value)}
                        className="w-full h-full bg-transparent text-[#d1d4dc] p-4 font-mono text-sm outline-none resize-none spellcheck-false"
                        placeholder="//@version=6..."
                    />
                </div>
            </div>
        </div>
    );
};

export default PineEditor;

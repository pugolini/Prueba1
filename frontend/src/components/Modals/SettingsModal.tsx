import React from 'react';
import axios from 'axios';
import { useStore } from '../../store/useStore';
import { X, Shield, Server, User, Key, CheckCircle, AlertCircle } from 'lucide-react';

const SettingsModal: React.FC = () => {
  const { isSettingsOpen, setSettingsOpen, rithmicConfig, setRithmicConfig } = useStore();

  if (!isSettingsOpen) return null;

  const handleSave = async () => {
    try {
      const resp = await axios.post('http://localhost:8005/api/rithmic/config', {
        user: rithmicConfig.user,
        pass: rithmicConfig.pass,
        system: rithmicConfig.system
      });
      if (resp.data.status === 'success') {
        console.log("[RITHMIC] Configuración sincronizada con el backend.");
        setSettingsOpen(false);
      }
    } catch (err) {
      console.error("[RITHMIC] Error sincronizando config:", err);
      // Cerramos de todos modos para que el usuario no se sienta bloqueado, 
      // pero logueamos el error.
      setSettingsOpen(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#1e222d] border border-[#363a45] w-full max-w-md rounded-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#363a45]">
          <div className="flex items-center gap-3">
            <div className="bg-blue-500/10 p-2 rounded-lg text-blue-500">
              <Shield size={20} />
            </div>
            <h2 className="text-lg font-bold text-white">Configuración del Sistema</h2>
          </div>
          <button 
            onClick={() => setSettingsOpen(false)}
            className="text-[#787b86] hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Rithmic Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 text-sm font-semibold text-blue-400">
                <ActivityIcon size={16} />
                <span>RITHMIC BRIDGE (APEX)</span>
              </div>
              <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold ${rithmicConfig.connected ? 'bg-green-500/10 text-green-500' : 'bg-orange-500/10 text-orange-500'}`}>
                {rithmicConfig.connected ? <CheckCircle size={10} /> : <AlertCircle size={10} />}
                {rithmicConfig.connected ? 'CONECTADO' : 'PENDIENTE'}
              </div>
            </div>

            <div className="space-y-4 bg-[#2a2e39]/30 p-4 rounded-xl border border-[#363a45]">
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[#787b86] ml-1 uppercase">Usuario Rithmic / Apex</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#787b86]">
                    <User size={14} />
                  </div>
                  <input 
                    type="text"
                    value={rithmicConfig.user}
                    onChange={(e) => setRithmicConfig({ user: e.target.value })}
                    className="w-full bg-[#131722] border border-[#363a45] rounded-lg py-2 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-medium"
                    placeholder="Tu usuario de Apex"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[#787b86] ml-1 uppercase">Contraseña</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#787b86]">
                    <Key size={14} />
                  </div>
                  <input 
                    type="password"
                    value={rithmicConfig.pass}
                    onChange={(e) => setRithmicConfig({ pass: e.target.value })}
                    className="w-full bg-[#131722] border border-[#363a45] rounded-lg py-2 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-[#787b86] ml-1 uppercase">Sistema de Datos</label>
                <div className="relative">
                  <div className="absolute left-3 top-1/2 -translate-y-1/2 text-[#787b86]">
                    <Server size={14} />
                  </div>
                  <select 
                    value={rithmicConfig.system}
                    onChange={(e) => setRithmicConfig({ system: e.target.value })}
                    className="w-full bg-[#131722] border border-[#363a45] rounded-lg py-2 pl-9 pr-4 text-sm text-white focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 appearance-none cursor-pointer"
                  >
                    <option value="Rithmic Paper Trading">Rithmic Paper Trading (Apex)</option>
                    <option value="Rithmic 01">Rithmic 01 (Real)</option>
                    <option value="Apex Trader Funding">Apex Trader Funding</option>
                  </select>
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-[#787b86]">
                    <ChevronDownIcon size={14} />
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-blue-500/5 text-blue-400 p-3 rounded-lg flex gap-3 text-[11px] border border-blue-500/10 leading-relaxed">
              <AlertCircle size={14} className="shrink-0 mt-0.5" />
              <p>Tus credenciales se guardan localmente. Asegúrate de tener R|Trader Pro abierto con el "Plug-in mode" activo para conectar el flujo de datos institucionales.</p>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-[#2a2e39]/50 flex justify-end gap-3 border-t border-[#363a45]">
          <button 
            onClick={() => setSettingsOpen(false)}
            className="px-4 py-2 text-sm font-bold text-[#787b86] hover:text-white transition-colors"
          >
            CERRAR
          </button>
          <button 
            onClick={handleSave}
            className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg text-sm font-black shadow-lg shadow-blue-500/20 transition-all active:scale-95 uppercase tracking-wide"
          >
            Guardar y Conectar
          </button>
        </div>
      </div>
    </div>
  );
};

// Internal icon helpers to avoid missing Lucide icons in some versions
const ActivityIcon: React.FC<any> = (props) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"></polyline></svg>
);
const ChevronDownIcon: React.FC<any> = (props) => (
  <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m6 9 6 6 6-6"/></svg>
);

export default SettingsModal;

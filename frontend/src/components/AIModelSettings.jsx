import React from 'react';
import { useWebLLMContext } from '../context/WebLLMContext';
import { Trash2, CheckCircle2, DownloadCloud, Loader2, BrainCircuit } from 'lucide-react';

export default function AIModelSettings({ isOpen, onClose }) {
  const { 
    selectedModelId, 
    availableModels, 
    cacheStatus, 
    switchModel, 
    deleteCache,
    isReady,
    isInitializing,
    progressText,
    init
  } = useWebLLMContext();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
      <div className="bg-[#151b2b] border border-white/10 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[85vh]">
        <div className="p-6 border-b border-white/10 flex justify-between items-center">
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            AI Model Settings
          </h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors text-2xl leading-none">
            &times;
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto flex-1">
          <div className="mb-6">
            <label className="block text-sm font-medium text-slate-300 mb-2">
              Active AI Model
            </label>
            <select
              value={selectedModelId}
              onChange={(e) => switchModel(e.target.value)}
              className="w-full bg-[#0a0f1e] border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-teal-500 transition-colors"
            >
              {availableModels.map(model => (
                <option key={model.model_id} value={model.model_id}>
                  {model.model_id}
                </option>
              ))}
            </select>
            <p className="text-xs text-slate-500 mt-2 mb-4">
              Select a model. Larger models are smarter but require more memory and take longer to download initially.
            </p>

            {!isReady && !isInitializing && (
                <button 
                  onClick={() => init()} 
                  className="w-full bg-teal-600 hover:bg-teal-500 text-white font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 transition-colors shadow-sm"
                >
                  <BrainCircuit size={18} />
                  {cacheStatus[selectedModelId] ? "Start Offline AI Engine" : "Download & Start AI Engine"}
                </button>
            )}
            
            {isInitializing && (
                <div className="w-full bg-teal-900/30 text-teal-400 font-medium py-2.5 rounded-lg flex flex-col items-center justify-center gap-2 border border-teal-500/30">
                  <div className="flex items-center gap-2">
                    <Loader2 size={16} className="animate-spin" />
                    <span className="text-sm">Starting AI Engine...</span>
                  </div>
                  <span className="text-xs opacity-75">{progressText}</span>
                </div>
            )}
            
            {isReady && (
                <div className="w-full bg-emerald-900/30 text-emerald-400 font-medium py-2.5 rounded-lg flex items-center justify-center gap-2 border border-emerald-500/30">
                  <CheckCircle2 size={18} />
                  AI Engine is Running
                </div>
            )}
          </div>

          <div>
            <h3 className="text-sm font-medium text-slate-300 mb-3">Model Cache Management</h3>
            <div className="space-y-2">
              {availableModels.map(model => {
                const isCached = cacheStatus[model.model_id];
                const isSelected = selectedModelId === model.model_id;

                return (
                  <div key={model.model_id} className={`flex items-center justify-between p-3 rounded-lg border ${isSelected ? 'border-teal-500/50 bg-teal-500/10' : 'border-white/5 bg-[#0a0f1e]'}`}>
                    <div className="flex items-center gap-3">
                      {isCached ? (
                         <CheckCircle2 size={18} className="text-emerald-400" />
                      ) : (
                         <DownloadCloud size={18} className="text-slate-500" />
                      )}
                      <div>
                        <p className="text-sm font-medium text-slate-200">
                          {model.model_id} {isSelected && <span className="text-xs text-teal-400 ml-2">(Active)</span>}
                        </p>
                        <div className="text-xs text-slate-500 mt-0.5">
                          {isCached ? 'Downloaded and ready offline' : 'Will download on next use'}
                          {model.vram_required_MB && (
                            <span className="ml-2 inline-flex items-center gap-1 bg-white/5 px-2 py-0.5 rounded text-[10px]">
                              ~{(model.vram_required_MB / 1024).toFixed(1)} GB
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex gap-2">
                      {!isCached && !isSelected && (
                        <button 
                          onClick={() => switchModel(model.model_id)}
                          className="px-3 py-1.5 text-teal-400 hover:bg-teal-400/10 rounded-lg transition-colors flex items-center gap-2 text-xs font-medium border border-teal-500/30"
                          title="Download and set as active"
                        >
                          <DownloadCloud size={14} /> Download
                        </button>
                      )}
                      
                      {isCached && (
                        <button 
                          onClick={() => deleteCache(model.model_id)}
                          className="p-2 text-rose-400 hover:bg-rose-400/10 rounded-lg transition-colors"
                          title="Delete cached model"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-white/10 bg-black/20 flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-teal-600 hover:bg-teal-500 text-white font-medium rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

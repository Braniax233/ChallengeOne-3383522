import React from 'react';
import { useWebLLMContext } from '../context/WebLLMContext';
import { Trash2, CheckCircle2, DownloadCloud } from 'lucide-react';

export default function AIModelSettings({ isOpen, onClose }) {
  const { 
    selectedModelId, 
    availableModels, 
    cacheStatus, 
    switchModel, 
    deleteCache 
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
            <p className="text-xs text-slate-500 mt-2">
              Select a model. Larger models are smarter but require more memory and take longer to download initially.
            </p>
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
                        <p className="text-xs text-slate-500">
                          {isCached ? 'Downloaded and ready offline' : 'Will download on next use'}
                        </p>
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

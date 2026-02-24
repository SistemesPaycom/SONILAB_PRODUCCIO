
import React, { useState, useEffect } from 'react';
import * as Icons from '../icons';
import { SUPPORTED_LANGUAGES } from '../../constants';

interface SubtitleAIOperationsModalProps {
  isOpen: boolean;
  onClose: () => void;
  mode: 'whisper' | 'translate' | 'revision';
  onWhisper: (audioLang: string) => void;
  onTranslate: (sourceLang: string, targetLang: string) => void;
  onRevision: () => void;
  isProcessing: boolean;
}

const SubtitleAIOperationsModal: React.FC<SubtitleAIOperationsModalProps> = ({ 
    isOpen, onClose, mode, onWhisper, onTranslate, onRevision, isProcessing 
}) => {
  const [activeTab, setActiveTab] = useState<'whisper' | 'translate' | 'revision'>(mode);
  const [whisperLang, setWhisperLang] = useState('en');
  const [sourceLang, setSourceLang] = useState('en');
  const [targetLang, setTargetLang] = useState('ca');

  useEffect(() => {
    setActiveTab(mode);
  }, [mode, isOpen]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-[200] p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="bg-gray-800 border border-gray-700 rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
        
        {/* Capçalera */}
        <div className="p-6 bg-gray-900/50 border-b border-gray-700 flex items-center justify-between">
           <div className="flex items-center gap-3">
               <div className={`p-3 rounded-xl ${
                   activeTab === 'whisper' ? 'bg-indigo-600/20 text-indigo-400' : 
                   activeTab === 'translate' ? 'bg-violet-600/20 text-violet-400' : 
                   'bg-emerald-600/20 text-emerald-400'
               }`}>
                    {activeTab === 'whisper' ? <Icons.EarIcon size={24} /> : 
                     activeTab === 'translate' ? <Icons.Languages size={24} /> : 
                     <span className="font-black text-xl leading-none">R</span>}
               </div>
               <div>
                   <h2 className="text-xl font-black text-white uppercase tracking-tighter">Operacions IA</h2>
                   <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Processament Local Whisper / Qwen</p>
               </div>
           </div>
           <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors text-3xl">&times;</button>
        </div>

        {/* Pestanyes */}
        <div className="flex bg-gray-900/30 border-b border-gray-800">
           <button 
                onClick={() => setActiveTab('whisper')}
                className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'whisper' ? 'bg-indigo-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
           >
               Whisper
           </button>
           <button 
                onClick={() => setActiveTab('translate')}
                className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'translate' ? 'bg-violet-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
           >
               Traducció
           </button>
           <button 
                onClick={() => setActiveTab('revision')}
                className={`flex-1 py-4 text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === 'revision' ? 'bg-emerald-600 text-white shadow-lg' : 'text-gray-500 hover:text-gray-300'}`}
           >
               Revisió (R)
           </button>
        </div>

        {/* Contingut */}
        <div className="p-8">
            {activeTab === 'whisper' && (
                <div className="space-y-6">
                    <div className="bg-indigo-900/10 border border-indigo-500/20 p-4 rounded-xl text-xs text-indigo-300 leading-relaxed italic">
                        Converteix l'àudio del vídeo en subtítols mitjançant el model local Whisper.
                    </div>
                    <div>
                        <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Idioma de l'Àudio</label>
                        <select 
                            value={whisperLang} 
                            onChange={(e) => setWhisperLang(e.target.value)}
                            className="w-full bg-gray-900 border border-gray-700 text-gray-100 rounded-xl px-4 py-3 text-sm focus:border-indigo-500 outline-none transition-all"
                        >
                            {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                        </select>
                    </div>
                    <button 
                        disabled={isProcessing}
                        onClick={() => onWhisper(whisperLang)}
                        className="w-full py-4 bg-indigo-600 hover:bg-indigo-500 disabled:bg-gray-700 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-xl flex items-center justify-center gap-3"
                    >
                        {isProcessing ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Icons.EarIcon size={16} />}
                        Iniciar Whisper
                    </button>
                </div>
            )}

            {activeTab === 'translate' && (
                <div className="space-y-6">
                    <div className="bg-violet-900/10 border border-violet-500/20 p-4 rounded-xl text-xs text-violet-300 italic">
                        Traducció optimitzada mitjançant Qwen local.
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Origen</label>
                            <select value={sourceLang} onChange={(e) => setSourceLang(e.target.value)} className="w-full bg-gray-900 border border-gray-700 text-gray-100 rounded-xl px-4 py-3 text-sm">
                                {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-[10px] font-black text-gray-500 uppercase tracking-widest mb-2">Destí</label>
                            <select value={targetLang} onChange={(e) => setTargetLang(e.target.value)} className="w-full bg-gray-900 border border-gray-700 text-gray-100 rounded-xl px-4 py-3 text-sm">
                                {SUPPORTED_LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.name}</option>)}
                            </select>
                        </div>
                    </div>
                    <button 
                        disabled={isProcessing}
                        onClick={() => onTranslate(sourceLang, targetLang)}
                        className="w-full py-4 bg-violet-600 hover:bg-violet-500 disabled:bg-gray-700 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-xl flex items-center justify-center gap-3"
                    >
                         {isProcessing ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <Icons.Languages size={16} />}
                         Iniciar Traducció
                    </button>
                </div>
            )}

            {activeTab === 'revision' && (
                <div className="space-y-6">
                    <div className="bg-emerald-900/10 border border-emerald-500/20 p-4 rounded-xl text-xs text-emerald-300 leading-relaxed italic">
                        Aquesta eina compararà el text dels subtítols actuals amb el contingut del guió original. Qualsevol discrepància serà marcada visualment amb un subratllat vermell.
                    </div>
                    <button 
                        disabled={isProcessing}
                        onClick={onRevision}
                        className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 text-white text-xs font-black uppercase tracking-widest rounded-xl transition-all shadow-xl flex items-center justify-center gap-3"
                    >
                         {isProcessing ? <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" /> : <span className="font-black">R</span>}
                         Iniciar Revisió de Coherència
                    </button>
                </div>
            )}
        </div>

        <div className="p-4 bg-gray-900/30 text-center">
            <button onClick={onClose} className="text-[10px] font-black text-gray-500 uppercase tracking-widest hover:text-gray-300">Tancar</button>
        </div>
      </div>
    </div>
  );
};

export default SubtitleAIOperationsModal;

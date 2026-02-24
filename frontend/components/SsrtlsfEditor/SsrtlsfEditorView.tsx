
import React, { useState, useMemo, useEffect } from 'react';
import { Document } from '../../types';
import * as Icons from '../icons';
import { parseSsrtlsf, serializeSsrtlsf, SsrtListRow } from '../../utils/SubtitlesEditor/srtToSsrtlsf';

declare const XLSX: any;

interface SsrtlsfEditorViewProps {
  currentDoc: Document;
  isEditing: boolean;
  onClose: () => void;
  onUpdateContent: (newContent: string) => void;
}

export const SsrtlsfEditorView: React.FC<SsrtlsfEditorViewProps> = ({ currentDoc, isEditing, onClose, onUpdateContent }) => {
  // Use safe string fallback for unknown content types
  const rawContent = (Object.values(currentDoc.contentByLang)[0] as string) || '';
  const initialRows = useMemo(() => parseSsrtlsf(rawContent), [rawContent]);
  const [rows, setRows] = useState<SsrtListRow[]>(initialRows);

  useEffect(() => {
    // Re-parse when rawContent changes
    setRows(parseSsrtlsf(rawContent));
  }, [rawContent]);

  const handleCellChange = (index: number, field: keyof SsrtListRow, value: string) => {
    if (!isEditing) return;
    const newRows = [...rows];
    newRows[index] = { ...newRows[index], [field]: value };
    setRows(newRows);
  };

  const handleSave = () => {
    const newContent = serializeSsrtlsf(rows);
    onUpdateContent(newContent);
  };

  const exportToExcel = () => {
    const data = rows.map(r => ({ 'CODI TEMPS': r.tc, 'PERSONATGE': r.char, 'TEXT': r.text }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Subtítols Adaptació');
    XLSX.writeFile(wb, `${currentDoc.name.replace('.ssrtlsf', '')}.xlsx`);
  };

  return (
    <div className="flex flex-col h-full bg-gray-900 text-gray-200">
      <header className="bg-gray-800 h-16 flex items-center justify-between px-6 border-b border-gray-700 shadow-lg flex-shrink-0">
        <div className="flex items-center gap-4">
          <button onClick={onClose} className="p-2 hover:bg-gray-700 rounded-lg text-gray-400 transition-colors">
            <Icons.ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <h2 className="text-sm font-black text-white uppercase tracking-widest">Editor SSRTLSF (Adaptació)</h2>
            <p className="text-[10px] text-gray-500 font-bold">{currentDoc.name}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button 
            onClick={exportToExcel}
            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-black rounded-lg transition-all shadow-md uppercase tracking-wider"
          >
            <Icons.Download className="w-4 h-4" />
            Exportar Excel
          </button>
          {isEditing && (
            <button 
              onClick={handleSave}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-lg transition-all shadow-md uppercase tracking-wider"
            >
              Guardar Canvis
            </button>
          )}
        </div>
      </header>

      <main className="flex-1 overflow-auto p-4 md:p-8 bg-[#0f172a]">
        <div className="max-w-5xl mx-auto bg-white rounded-sm shadow-2xl overflow-hidden">
          <table className="w-full text-sm text-left border-collapse table-fixed">
            <thead className="bg-gray-100 text-gray-600 font-black uppercase text-[10px] border-b-2 border-gray-200">
              <tr>
                <th className="p-3 border-r border-gray-200 w-36">Codi de Temps</th>
                <th className="p-3 border-r border-gray-200 w-32">Pers.</th>
                <th className="p-3">Text del Subtítol</th>
              </tr>
            </thead>
            <tbody className="text-gray-900">
              {rows.map((row, idx) => (
                <tr key={row.id} className="border-b border-gray-100 hover:bg-blue-50/50 transition-colors group">
                  <td className="p-0 border-r border-gray-100 bg-gray-50/30">
                    <input 
                      type="text" 
                      value={row.tc} 
                      readOnly={!isEditing}
                      onChange={(e) => handleCellChange(idx, 'tc', e.target.value)}
                      className="w-full p-3 bg-transparent font-mono text-[12px] text-gray-500 focus:bg-white focus:text-blue-600 focus:outline-none transition-colors"
                    />
                  </td>
                  <td className="p-0 border-r border-gray-100">
                    <input 
                      type="text" 
                      value={row.char} 
                      readOnly={!isEditing}
                      onChange={(e) => handleCellChange(idx, 'char', e.target.value)}
                      className="w-full p-3 bg-transparent font-black text-blue-900 focus:bg-white focus:outline-none transition-colors text-center uppercase"
                    />
                  </td>
                  <td className="p-0">
                    <textarea 
                      value={row.text} 
                      readOnly={!isEditing}
                      rows={1}
                      onChange={(e) => handleCellChange(idx, 'text', e.target.value)}
                      className="w-full p-3 bg-transparent text-gray-900 resize-none focus:bg-white focus:outline-none block leading-relaxed min-h-[44px]"
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement;
                        target.style.height = 'auto';
                        target.style.height = target.scrollHeight + 'px';
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {rows.length === 0 && (
            <div className="p-20 text-center text-gray-400 italic">
                No hi ha dades per mostrar. Prova de convertir un SRT.
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

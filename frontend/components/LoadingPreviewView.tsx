import React, { useState } from 'react';

/**
 * Vista de previsualització de la pantalla de càrrega.
 * Accés: http://localhost:3000/#/loading-preview
 *
 * Mostra els dos overlays de càrrega (VideoPlayer + WaveformTimeline)
 * amb les seves mides i posicions reals, per poder ajustar l'animació
 * sense necessitat de carregar un vídeo real.
 *
 * Per provar un WebM diferent: pega la URL al camp de dalt i prem Enter.
 */

const DEFAULT_SRC = '/assets/loading.webm';

const LoadingPreviewView: React.FC = () => {
  const [src, setSrc] = useState(DEFAULT_SRC);
  const [inputVal, setInputVal] = useState(DEFAULT_SRC);

  const apply = () => setSrc(inputVal);

  return (
    <div className="h-screen flex flex-col bg-gray-950 text-white font-sans overflow-hidden">

      {/* Barra de controls */}
      <div className="flex-shrink-0 flex items-center gap-3 px-4 py-2 bg-gray-800 border-b border-gray-700">
        <span className="text-[11px] font-mono text-gray-400 whitespace-nowrap">
          Preview loading.webm
        </span>
        <input
          type="text"
          value={inputVal}
          onChange={e => setInputVal(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') apply(); }}
          className="flex-1 bg-gray-700 text-white text-xs font-mono px-3 py-1.5 rounded border border-gray-600 focus:outline-none focus:border-blue-500"
          placeholder="/assets/loading.webm"
        />
        <button
          onClick={apply}
          className="px-3 py-1.5 text-xs font-bold bg-blue-600 hover:bg-blue-500 rounded transition-colors"
        >
          Aplicar
        </button>
        <a
          href="#/"
          className="text-xs text-gray-400 hover:text-white transition-colors whitespace-nowrap"
        >
          ← Tornar
        </a>
      </div>

      {/* Layout que replica l'editor real */}
      <div className="flex-1 flex flex-col min-h-0">

        {/* ── Àrea de video (flex-1, fons negre) ── */}
        <div className="flex-1 relative bg-black min-h-0 flex items-center justify-center">

          {/* Overlay de càrrega — preview: 40% de l'alçada del contenidor */}
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 pointer-events-none">
            <video
              key={src}
              src={src}
              autoPlay
              loop
              muted
              playsInline
              className="h-2/5 aspect-square"
            />
          </div>

          {/* Etiqueta informativa */}
          <div className="absolute top-3 left-3 z-30 text-[10px] font-mono text-gray-500 pointer-events-none">
            VideoPlayer — overlay càrrega — <span className="text-gray-400">40% de l'alçada · producció: w-20 h-20 (80px)</span>
          </div>

          {/* Mock del vídeo: gradient fosc per donar context */}
          <div
            className="w-full h-full"
            style={{ background: 'linear-gradient(160deg, #1a1a2e 0%, #0d0d0d 100%)' }}
          />
        </div>

        {/* ── Separador ── */}
        <div className="h-px bg-gray-700 flex-shrink-0" />

        {/* ── Àrea de waveform (150px fixos) ── */}
        <div className="h-[150px] flex-shrink-0 relative bg-gray-900">

          {/* Overlay de càrrega — preview: alçada completa del waveform (150px) */}
          <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
            <video
              key={src + '-wave'}
              src={src}
              autoPlay
              loop
              muted
              playsInline
              className="h-full aspect-square"
            />
          </div>

          {/* Etiqueta informativa */}
          <div className="absolute top-2 left-3 z-30 text-[10px] font-mono text-gray-500 pointer-events-none">
            WaveformTimeline — overlay càrrega — <span className="text-gray-400">alçada completa (150px) · producció: w-12 h-12 (48px)</span>
          </div>

          {/* Mock de la forma d'ona: línies horitzontals */}
          <div className="absolute inset-0 flex flex-col justify-center gap-1 px-4 opacity-10 pointer-events-none">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-px bg-gray-400 w-full" />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default LoadingPreviewView;

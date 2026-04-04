import React from 'react';

/**
 * Overlay de càrrega de vídeo/àudio.
 *
 * Per activar l'asset de marca:
 *   1. Exporta el teu asset en format WebM amb canal alpha (VP9 alpha).
 *      Ha de ser quadrat (1:1), dissenyat per bucle perfecte (seamless loop).
 *   2. Col·loca'l a: frontend/public/assets/loading.webm
 *   3. Canvia LOADING_SRC a: '/assets/loading.webm'
 *
 * Formats suportats per ordre de preferència:
 *   - WebM VP9 amb alpha  → <video loop> + transparència + molt lleuger
 *   - APNG                → si és animació de fotogrames (sense libreria addicional)
 *   - Lottie JSON         → si és vectorial (requereix lottie-web)
 *   - NO usar .mov        → no és suportat nativament pels navegadors
 */
const LOADING_SRC: string | null = '/assets/loading.webm'; // TODO: canviar a '/assets/loading.webm'

const LoadingOverlay: React.FC = () => (
  <div className="absolute inset-0 z-20 flex items-center justify-center bg-black/50 pointer-events-none">
    {LOADING_SRC ? (
      <video
        src={LOADING_SRC}
        autoPlay
        loop
        muted
        playsInline
        className="w-20 h-20"
      />
    ) : (
      /* Placeholder: spinner CSS fins que hi hagi un asset de marca */
      <div className="w-16 h-16 rounded-full border-4 border-white/15 border-t-white animate-spin" />
    )}
  </div>
);

export default LoadingOverlay;

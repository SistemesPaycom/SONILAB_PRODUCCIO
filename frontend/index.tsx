
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { applyPendingFactoryReset } from './utils/factoryReset';

// BEFORE mounting the React tree: if a factory reset is pending from a previous
// reload, apply the localStorage cleanup synchronously now — BEFORE any provider
// (Theme, Auth, Transcription, Translation, UserStyles, LibraryData) mounts.
// This eliminates the race condition where useEffect persistence hooks could
// re-write keys during the reload window. See spec section 5 "Fase B".
applyPendingFactoryReset();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

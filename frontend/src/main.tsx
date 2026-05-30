import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles/tokens.css';
import './styles/design-system-v2.css';
import './styles/primitives.css';
import { applyAppearance, readCachedAppearance } from './lib/theme/appearance';

// V072 — applique le dernier thème connu (cache local) AVANT le premier rendu,
// pour éviter tout flash clair → sombre. AppearanceProvider reconcilie ensuite
// avec la valeur cabinet renvoyée par /settings/clinic.
applyAppearance(readCachedAppearance());

const container = document.getElementById('root');
if (!container) {
  throw new Error('Root container missing in index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

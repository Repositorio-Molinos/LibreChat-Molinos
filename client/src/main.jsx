import 'regenerator-runtime/runtime';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/nunito/index.css';
import '@fontsource-variable/nunito/wght-italic.css';
import './locales/i18n';
import App from './App';
import './style.css';
import './mobile.css';
import { ApiErrorBoundaryProvider } from './hooks/ApiErrorBoundaryContext';
import 'katex/dist/katex.min.css';
import 'katex/dist/contrib/copy-tex.js';

const container = document.getElementById('root');
const root = createRoot(container);

root.render(
  <ApiErrorBoundaryProvider>
    <App />
  </ApiErrorBoundaryProvider>,
);

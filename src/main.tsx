import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary.tsx';
import { ThemeProvider } from './lib/theme.tsx';
import './index.css';

if ('serviceWorker' in navigator) {
  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js');
      await registration.update();

      if (registration.waiting) {
        registration.waiting.postMessage('SKIP_WAITING');
      }

      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            newWorker.postMessage('SKIP_WAITING');
          }
        });
      });

      let hasRefreshed = false;
      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (hasRefreshed) return;
        hasRefreshed = true;
        window.location.reload();
      });

      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith('pulseboard-cache-') && key !== 'pulseboard-cache-v3')
          .map((key) => caches.delete(key))
      );
    } catch (registrationError) {
      console.log('SW registration failed: ', registrationError);
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  </StrictMode>,
);

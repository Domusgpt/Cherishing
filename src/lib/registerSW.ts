/**
 * Register the offline service worker in production builds only. In dev we skip
 * it so Vite's hot reload isn't fighting a cache.
 */
export function registerServiceWorker(): void {
  if (!import.meta.env.PROD) return;
  if (!('serviceWorker' in navigator)) return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {
      /* offline support is a nice-to-have; ignore registration failures */
    });
  });
}

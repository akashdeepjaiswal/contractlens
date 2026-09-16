'use client';

import { useEffect } from 'react';

/**
 * PWARegistration handles background service worker registration
 * and offline caching without showing any intrusive install popups.
 */
export default function PWARegistration() {
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            registration.onupdatefound = () => {
              const installingWorker = registration.installing;
              if (installingWorker) {
                installingWorker.onstatechange = () => {
                  if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    console.log('[SW] New content available; will update on reload.');
                  }
                };
              }
            };
          })
          .catch((err) => {
            console.warn('[SW] Service worker registration failed:', err);
          });
      });
    }
  }, []);

  return null;
}

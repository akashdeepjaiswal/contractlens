'use client';

import { useEffect, useState } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function PWARegistration() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [showInstallBanner, setShowInstallBanner] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);

  useEffect(() => {
    // 1. Service Worker registration
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker
          .register('/sw.js')
          .then((registration) => {
            // Check for updates periodically
            registration.onupdatefound = () => {
              const installingWorker = registration.installing;
              if (installingWorker) {
                installingWorker.onstatechange = () => {
                  if (installingWorker.state === 'installed' && navigator.serviceWorker.controller) {
                    console.log('[SW] New content is available; please refresh.');
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

    // 2. Check standalone display mode (already installed)
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;

    if (isStandalone) {
      setIsInstalled(true);
      return;
    }

    // 3. Capture beforeinstallprompt for PWA installation
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      // Check if user previously dismissed
      const dismissed = localStorage.getItem('cl-pwa-dismissed');
      if (!dismissed) {
        setShowInstallBanner(true);
      }
    };

    const handleAppInstalled = () => {
      setDeferredPrompt(null);
      setShowInstallBanner(false);
      setIsInstalled(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const handleInstallClick = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShowInstallBanner(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShowInstallBanner(false);
    try {
      localStorage.setItem('cl-pwa-dismissed', 'true');
    } catch {}
  };

  if (!showInstallBanner || isInstalled) {
    return null;
  }

  return (
    <div className="pwa-install-banner" role="region" aria-label="Install ContractLens App">
      <div className="pwa-install-content">
        <div className="pwa-install-icon">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
        </div>
        <div className="pwa-install-text">
          <p className="pwa-install-title">Install ContractLens</p>
          <p className="pwa-install-subtitle">Fast offline access & standalone app experience</p>
        </div>
        <div className="pwa-install-actions">
          <button
            type="button"
            onClick={handleInstallClick}
            className="btn btn-primary btn-sm pwa-btn-install"
            id="pwa-install-btn"
          >
            Install
          </button>
          <button
            type="button"
            onClick={handleDismiss}
            className="pwa-btn-dismiss"
            aria-label="Dismiss install banner"
            title="Dismiss"
          >
            ✕
          </button>
        </div>
      </div>
    </div>
  );
}

import type { Metadata, Viewport } from 'next';
import './globals.css';
import AppShell from '@/components/AppShell';
import PWARegistration from '@/components/PWARegistration';

export const viewport: Viewport = {
  themeColor: '#4f46e5',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'ContractLens — Contract Review for Non-Lawyers',
  description:
    'Upload vendor contracts and instantly extract, understand, and query every clause. Built for founders who review contracts without a lawyer.',
  keywords: ['contract review', 'legal tech', 'clause extraction', 'vendor contracts', 'pwa'],
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'ContractLens',
  },
  icons: {
    icon: [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
      { url: '/icons/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [
      { url: '/icons/apple-touch-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" data-theme="light" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var t = localStorage.getItem('cl-theme');
                if (t === 'dark' || t === 'light') {
                  document.documentElement.setAttribute('data-theme', t);
                } else {
                  document.documentElement.setAttribute('data-theme', 'light');
                }
              } catch(e) {}
            `,
          }}
        />
      </head>
      <body>
        <PWARegistration />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}


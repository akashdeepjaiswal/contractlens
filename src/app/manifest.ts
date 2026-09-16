import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'ContractLens — Contract Review for Non-Lawyers',
    short_name: 'ContractLens',
    description: 'Upload vendor contracts and instantly extract, understand, and query every clause.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#f8fafc',
    theme_color: '#4f46e5',
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
      },
    ],
  };
}

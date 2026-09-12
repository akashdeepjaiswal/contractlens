import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Increase the body parser limit for large PDF uploads
  experimental: {
    serverActions: {
      bodySizeLimit: '52mb',
    },
  },
  // Disable the default body parser size limit for API routes
  // handled per-route via route.ts config
};

export default nextConfig;

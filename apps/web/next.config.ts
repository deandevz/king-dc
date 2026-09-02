import { resolve } from 'node:path';
import type { NextConfig } from 'next';

/** Alvo interno da API. No compose é `http://api:3000`; fora, `http://localhost:3000`. */
const apiInternalUrl = process.env.API_INTERNAL_URL ?? 'http://localhost:3000';

const nextConfig: NextConfig = {
  output: 'standalone',
  // O monorepo é pnpm: sem isso o standalone não rastreia os symlinks do workspace.
  outputFileTracingRoot: resolve(import.meta.dirname, '../..'),
  reactStrictMode: true,
  async rewrites() {
    // Decisão D16: o browser só conhece a origem do web. Sem CORS, cookie SameSite=Lax.
    return [
      { source: '/api/:path*', destination: `${apiInternalUrl}/:path*` },
      { source: '/avatars/:path*', destination: `${apiInternalUrl}/avatars/:path*` },
    ];
  },
};

export default nextConfig;

import type { NextConfig } from 'next';
import { withSentryConfig } from '@sentry/nextjs';

const config: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ['localhost:3000', 'properdata.ie', '*.vercel.app'],
    },
  },
  transpilePackages: [
    '@properdata/agents',
    '@properdata/db',
    '@properdata/scrapers',
    '@properdata/shared',
  ],
  typescript: {
    ignoreBuildErrors: false,
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
};

export default withSentryConfig(config, {
  silent: true,
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
});

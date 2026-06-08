import bundleAnalyzer from '@next/bundle-analyzer';

const withBundleAnalyzer = bundleAnalyzer({
  enabled: process.env.ANALYZE === 'true',
});

// Content Security Policy — keep this list TIGHT and add per app needs only.
// Notes:
//   - 'unsafe-inline' on style-src is unfortunately required by next/font
//     and Tailwind's runtime. Removing it breaks all styles.
//   - 'unsafe-eval' would be required for dev mode (next-dev's HMR uses
//     eval). We allow it in dev only.
//   - connect-src must include the API origin; we read it from env at build
//     time and fall back to localhost for dev.
const apiOrigin = process.env.NEXT_PUBLIC_API_BASE_URL
  ? new URL(process.env.NEXT_PUBLIC_API_BASE_URL).origin
  : 'http://localhost:3000';

const isDev = process.env.NODE_ENV !== 'production';

const csp = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
  `style-src 'self' 'unsafe-inline' https://fonts.googleapis.com`,
  `img-src 'self' data: blob: https://*.shopee.co.th https://*.lazada.co.th https://*.makro.pro https://*.alibaba.com`,
  `font-src 'self' https://fonts.gstatic.com data:`,
  `connect-src 'self' ${apiOrigin}${isDev ? ' ws: http://localhost:*' : ''}`,
  `frame-ancestors 'none'`,
  `base-uri 'self'`,
  `form-action 'self'`,
].join('; ');

const securityHeaders = [
  { key: 'Content-Security-Policy',   value: csp },
  { key: 'X-Frame-Options',           value: 'DENY' },
  { key: 'X-Content-Type-Options',    value: 'nosniff' },
  { key: 'Referrer-Policy',           value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy',        value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
];

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,

  // Next.js Image optimization — only allow remote hosts we explicitly trust.
  // Adding a host here is a security boundary: anything listed can be fed
  // through our /next/image proxy and served from our domain.
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: '*.shopeemobile.com' },
      { protocol: 'https', hostname: 'cf.shopee.co.th' },
      { protocol: 'https', hostname: 'sg-test-11.slatic.net' },
      { protocol: 'https', hostname: '*.alicdn.com' },
      { protocol: 'https', hostname: '*.makro.pro' },
    ],
    formats: ['image/avif', 'image/webp'],
    // 1 hour browser cache; CDN can extend via Cache-Control.
    minimumCacheTTL: 60 * 60,
  },

  // Shave the tree-shaking on big icon libraries — lucide-react ships hundreds
  // of icons and modularizeImports prevents pulling the whole bundle.
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{kebabCase member}}',
    },
  },

  experimental: {
    // Tighter server-component bundle: avoids shipping these packages to the
    // browser by tagging them as server-only externals.
    serverComponentsExternalPackages: ['@sentry/nextjs'],
    // Optimize Next's own runtime CSS extraction.
    optimizeCss: true,
  },

  async headers() {
    return [
      // Security headers on every route.
      { source: '/(.*)', headers: securityHeaders },
      // Hashed Next.js static assets are content-addressed — cache for a year.
      {
        source: '/_next/static/(.*)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      // Image responses cache briefly at the edge and can revalidate.
      {
        source: '/_next/image(.*)',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=3600, stale-while-revalidate=86400' }],
      },
    ];
  },
};

export default withBundleAnalyzer(nextConfig);

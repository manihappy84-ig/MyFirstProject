/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,

  // This is the key config for Next.js 13/14:
  // Prevents pdfjs-dist (and canvas) from being bundled by webpack on the server.
  // Instead they are required directly from node_modules at runtime.
  experimental: {
    serverComponentsExternalPackages: ['pdfjs-dist', 'canvas'],
    outputFileTracingIncludes: {
      '/api/convert/to-text': ['./node_modules/pdfjs-dist/legacy/build/pdf.worker.js'],
      '/api/convert/to-word': ['./node_modules/pdfjs-dist/legacy/build/pdf.worker.js'],
      '/api/convert/unlock': ['./node_modules/pdfjs-dist/legacy/build/pdf.worker.js'],
    },
  },

  webpack: (config, { isServer }) => {
    if (!config.resolve) config.resolve = {}
    if (!config.resolve.fallback) config.resolve.fallback = {}

    // Stub browser-only modules on the server
    if (!isServer) {
      config.resolve.fallback.canvas = false
      config.resolve.fallback.fs = false
      config.resolve.fallback.path = false
      config.resolve.fallback.os = false
    }

    return config
  },
}

module.exports = nextConfig

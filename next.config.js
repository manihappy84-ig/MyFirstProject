/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  webpack: (config, { isServer }) => {
    // stub out canvas to avoid build errors in environments where it's unavailable
    if (!config.resolve) config.resolve = {};
    if (!config.resolve.fallback) config.resolve.fallback = {};
    config.resolve.fallback.canvas = false;

    // on the server we can also mark it external just in case
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push({ canvas: 'commonjs canvas' });
    }

    return config;
  },
}

module.exports = nextConfig

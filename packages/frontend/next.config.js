/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  reactStrictMode: false,
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'localhost',
      },
    ],
  },
  // Config para evitar errores de prerendering
  typescript: {
    ignoreBuildErrors: true,
  },
  // Soporte para webpack y turbopack
  webpack: (config, { dev, isServer }) => {
    if (dev) {
      config.watchOptions = {
        poll: 1000,
        aggregateTimeout: 300,
      };
    }

    // Ignorar archivos de test durante la compilación
    config.resolve.alias = {
      ...config.resolve.alias,
      '__tests__': false,
    };

    // Excluir archivos .test y .spec del bundling
    config.module.rules.push({
      test: /\.(test|spec)\.(ts|tsx|js|jsx)$/,
      loader: 'ignore-loader',
    });

    return config;
  },
  // Turbopack no soporta ignorar archivos como webpack
  // Los archivos de test se ignoran por convención de nombres
  // API proxy al backend
  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: "http://agento-server:3001/api/v1/:path*",
      },
    ];
  },
};

module.exports = nextConfig;

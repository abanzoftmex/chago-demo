/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
 
  // Configuración de headers para cache
  async headers() {
    return [
      {
        // Archivos estáticos de Next.js (JS, CSS)
        source: "/_next/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            // Cache por 1 hora, revalidar después
            value: "public, max-age=3600, stale-while-revalidate=86400",
          },
        ],
      },
      {
        // Chunks de JavaScript específicos
        source: "/_next/static/chunks/(.*)",
        headers: [
          {
            key: "Cache-Control",
            // Cache por 1 hora, forzar revalidación
            value: "public, max-age=3600, must-revalidate",
          },
        ],
      },
      {
        // Páginas compiladas
        source: "/_next/static/chunks/pages/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, must-revalidate",
          },
        ],
      },
      {
        // Archivos JavaScript en general
        source: "/(.*).js",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=3600, must-revalidate",
          },
        ],
      },
      {
        // API routes - sin cache para evitar problemas
        source: "/api/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "no-cache, no-store, must-revalidate",
          },
        ],
      },
    ];
  },

  // Configuración de build ID para invalidar cache con cada deploy
  generateBuildId: async () => {
    // Usar timestamp redondeado a la hora más cercana
    const now = new Date();
    const hour = Math.floor(now.getTime() / (1000 * 60 * 60));
    return `build-${hour}`;
  },

  // Optimizaciones adicionales
  compiler: {
    removeConsole: false, // Set to true in production builds
  },
};

export default nextConfig;

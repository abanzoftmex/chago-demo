/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Deshabilitado para demo

  async headers() {
    return [
      {
        /*
          Todo lo que Next.js emite bajo /_next/static lleva un hash en el nombre
          del fichero: si el contenido cambia, cambia la URL. Por eso se cachea
          para siempre.

          Aquí antes había `max-age=3600, must-revalidate`, que anulaba el
          `immutable` que Next pone por defecto. El efecto no era solo más
          peticiones: un cliente podía quedarse hasta una hora con el HTML y el
          manifest viejos y pedir chunks que ya no existían en el servidor, lo
          que revienta la navegación con un ChunkLoadError.
        */
        source: "/_next/static/(.*)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
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

  /*
    Sin `generateBuildId`: Next.js genera un id único por build.

    Antes se usaba `build-${hora}`, lo que significaba que dos despliegues dentro
    de la misma hora compartían id. Next lo usa para las rutas /_next/data/<id>/,
    así que un cliente con la página abierta pedía datos con un id que ya
    apuntaba a otro build.
  */

  // Optimizaciones adicionales
  compiler: {
    removeConsole: false, // Set to true in production builds
  },
};

export default nextConfig;

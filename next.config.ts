import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  cacheComponents: true,
  partialPrefetching: true,
  // Semanas pasó a ser Calendario: un enlace viejo (con su ?pieza= o ?semana=, que se conservan)
  // llega a la pantalla nueva. Temporal (307) para que el navegador no la guarde para siempre.
  async redirects() {
    return [{ source: '/semanas', destination: '/calendario', permanent: false }];
  },
};

export default nextConfig;

import type { NextConfig } from "next";

const config: NextConfig = {
  transpilePackages: ["@hubly/application", "@hubly/contracts", "@hubly/db", "@hubly/ui"],
  // «Tu imagen» admite hasta 5 MB; el formulario añade algo de sobrecarga (#84, ADR 0008).
  // optimizePackageImports evita arrastrar todo @hubly/ui y @heroui/react a las rutas públicas (#291).
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
    optimizePackageImports: ["@hubly/ui", "@heroui/react"],
  },
  // El enlace de invitación lleva el token en el fragmento; sin Referer no hay forma de que se filtre la URL de la página.
  async headers() {
    const staticAssetCache = [{ key: "Cache-Control", value: "public, max-age=86400, stale-while-revalidate=604800" }];
    return [
      { source: "/invitacion", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
      { source: "/fondos/:path*", headers: staticAssetCache },
      { source: "/marca/:path*", headers: staticAssetCache },
    ];
  },
  // «Hoy» pasó a ser el Hub: los marcadores y correos con /hoy siguen funcionando (conserva ?bienvenida y ?herramienta).
  async redirects() {
    return [{ source: "/hoy", destination: "/hub", permanent: true }];
  },
};

export default config;

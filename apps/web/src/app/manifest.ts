import { tokens } from "@hubly/ui";
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hubly",
    short_name: "Hubly",
    description: "¿Qué sigue y quién lo tiene? Espacio de trabajo y flujo editorial para agencias.",
    start_url: "/hoy",
    display: "standalone",
    background_color: tokens.color.surfaceBrand,
    theme_color: tokens.color.accentPrimary,
    icons: [
      {
        src: "/marca/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/marca/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/marca/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}

import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://newhubly.vercel.app";

// Páginas públicas para buscadores (issue 129); el espacio de trabajo queda fuera.
const PUBLIC_PATHS = ["/", "/precios", "/login", "/privacidad", "/terminos"] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  return PUBLIC_PATHS.map((path) => ({ url: `${SITE_URL}${path === "/" ? "" : path}`, changeFrequency: "weekly", priority: path === "/" ? 1 : 0.6 }));
}

import "@hubly/ui/tokens.css";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import type { ReactNode } from "react";
import { THEME_BOOTSTRAP } from "./theme-bootstrap";

export const metadata: Metadata = {
  title: "Hubly",
  description: "Sistema de trabajo para agencias de redes sociales",
};

// El contenido llega al borde en móviles con muescas (las zonas seguras se respetan con env()) y, con el teclado virtual abierto, la página se redimensiona en vez de taparse.
export const viewport: Viewport = { viewportFit: "cover", interactiveWidget: "resizes-content" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="es" data-theme="light" suppressHydrationWarning>
      <body>
        <Script id="hubly-theme" strategy="beforeInteractive">
          {THEME_BOOTSTRAP}
        </Script>
        {children}
      </body>
    </html>
  );
}

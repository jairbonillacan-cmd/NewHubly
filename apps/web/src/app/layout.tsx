import "@hubly/ui/tokens.css";
import type { Metadata, Viewport } from "next";
import Script from "next/script";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Hubly",
  description: "Sistema de trabajo para agencias de redes sociales",
};

// El contenido llega al borde en móviles con muescas (las zonas seguras se respetan con env()) y, con el teclado virtual abierto, la página se redimensiona en vez de taparse.
export const viewport: Viewport = { viewportFit: "cover", interactiveWidget: "resizes-content" };

// Antes de pintar: activa las animaciones de entrada (solo con JavaScript) y aplica el tema guardado; sin preferencia queda el claro (#85).
const THEME_BOOTSTRAP = `document.documentElement.classList.add("hubly-motion");try{var t=localStorage.getItem("hubly-theme");var s=t==="system"&&window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.setAttribute("data-theme",t==="dark"||s?"dark":"light");var a=localStorage.getItem("hubly-accent");if(a&&a!=="azul"&&/^[a-z]+$/.test(a))document.documentElement.setAttribute("data-accent",a);var e=localStorage.getItem("hubly-estilo");if(e&&/^(papel|niebla|calido|medianoche|carbon)$/.test(e))document.documentElement.setAttribute("data-estilo",e)}catch(e){document.documentElement.setAttribute("data-theme","light")}`;

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

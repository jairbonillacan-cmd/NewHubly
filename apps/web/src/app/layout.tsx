import "@hubly/ui/tokens.css";
import type { Metadata } from "next";
import Script from "next/script";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Hubly",
  description: "Sistema de trabajo para agencias de redes sociales",
};

// Antes de pintar: activa las animaciones de entrada (solo con JavaScript) y aplica el tema guardado; sin preferencia queda el claro (#85).
const THEME_BOOTSTRAP = `document.documentElement.classList.add("hubly-motion");try{var t=localStorage.getItem("hubly-theme");document.documentElement.setAttribute("data-theme",t==="dark"?"dark":"light")}catch(e){document.documentElement.setAttribute("data-theme","light")}`;

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

import "@hubly/ui/tokens.css";
import type { Metadata } from "next";
import { headers } from "next/headers";
import Script from "next/script";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Hubly",
  description: "Sistema de trabajo para agencias de redes sociales",
};

// Antes de pintar: activa las animaciones de entrada (solo con JavaScript) y aplica el tema guardado; sin preferencia queda el claro (#85).
const THEME_BOOTSTRAP = `document.documentElement.classList.add("hubly-motion");try{var t=localStorage.getItem("hubly-theme");document.documentElement.setAttribute("data-theme",t==="dark"?"dark":"light")}catch(e){document.documentElement.setAttribute("data-theme","light")}`;

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Leer las cabeceras vuelve dinámico el render: así cada respuesta lleva el nonce de su CSP (#91).
  // Una página estática no puede tener nonce, y la CSP bloquearía sus scripts, incluido el del tema.
  const nonce = (await headers()).get("x-nonce") ?? undefined;
  return (
    <html lang="es" data-theme="light" suppressHydrationWarning>
      <body>
        <Script id="hubly-theme" strategy="beforeInteractive" nonce={nonce}>
          {THEME_BOOTSTRAP}
        </Script>
        {children}
      </body>
    </html>
  );
}

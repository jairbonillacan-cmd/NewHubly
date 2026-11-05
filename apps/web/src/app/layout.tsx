import "@hubly/ui/tokens.css";
import type { Metadata } from "next";
import { headers } from "next/headers";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  title: "Hubly",
  description: "Sistema de trabajo para agencias de redes sociales",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  // Leer las cabeceras vuelve dinámico el render: así cada respuesta lleva el nonce de su CSP (#91).
  // Una página estática no puede tener nonce, y la CSP bloquearía sus scripts.
  await headers();
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}

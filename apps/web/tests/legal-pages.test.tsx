import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PrivacyPage } from "../src/app/(public)/privacidad/page";
import { TermsPage } from "../src/app/(public)/terminos/page";

describe("Páginas públicas legales /privacidad y /terminos (#11)", () => {
  it("renderiza /privacidad con encabezado h1, secciones de soberanía/RLS/exportación y navegación de pie sin enlaces vacíos", () => {
    const html = renderToStaticMarkup(<PrivacyPage />);
    expect(html).toContain("<h1");
    expect(html).toContain("Política de Privacidad");
    expect(html).toContain("Titularidad y soberanía de los datos");
    expect(html).toContain("Aislamiento estricto por espacio de trabajo (RLS)");
    expect(html).toContain("Portabilidad y exportación abierta");
    expect(html).toContain("Retención y eliminación");
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/hub"');
    expect(html).toContain('href="/privacidad"');
    expect(html).toContain('href="/terminos"');
    expect(html).toContain("Volver al inicio");
    expect(html).toContain("Ir a tu Hub");
    expect(html).not.toContain('href="#"');
  });

  it("renderiza /terminos con encabezado h1, secciones de alcance/propiedad/transparencia y navegación de pie sin enlaces vacíos", () => {
    const html = renderToStaticMarkup(<TermsPage />);
    expect(html).toContain("<h1");
    expect(html).toContain("Términos de Servicio");
    expect(html).toContain("Alcance del servicio");
    expect(html).toContain("Propiedad intelectual del cliente");
    expect(html).toContain("Transparencia operativa");
    expect(html).toContain("Uso responsable y seguridad de la cuenta");
    expect(html).toContain('href="/"');
    expect(html).toContain('href="/hub"');
    expect(html).toContain('href="/privacidad"');
    expect(html).toContain('href="/terminos"');
    expect(html).toContain("Volver al inicio");
    expect(html).toContain("Ir a tu Hub");
    expect(html).not.toContain('href="#"');
  });
});

import { HoyPage } from "../hub/page";

export const dynamic = "force-dynamic";

/** Herramienta del carril con URL limpia (#212). Mientras no llegue, muestra su página «Próximamente». */
export default async function ReportesPage() {
  return HoyPage({ herramienta: "reportes" });
}

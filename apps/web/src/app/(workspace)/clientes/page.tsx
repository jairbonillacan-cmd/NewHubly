import { HoyPage } from "../inicio/page";

export const dynamic = "force-dynamic";

/** Herramienta del carril con URL limpia (#212). Mientras no llegue, muestra su página «Próximamente». */
export default async function ClientesPage() {
  return HoyPage({ herramienta: "clientes" });
}

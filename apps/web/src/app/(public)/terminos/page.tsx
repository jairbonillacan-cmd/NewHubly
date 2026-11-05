import { LegalPage } from "@hubly/ui";

const TERMS_SECTIONS = [
  {
    id: "alcance",
    title: "1. Alcance del servicio",
    body: "Hubly es un sistema de trabajo diseñado para ordenar la operación diaria y el flujo editorial de agencias de redes sociales, comenzando por el espacio personal de notas rápidas y pendientes accionables en la vista Hoy (/hoy).",
  },
  {
    id: "propiedad-intelectual",
    title: "2. Propiedad intelectual del cliente",
    body: "Todo el contenido, notas, pendientes, borradores y piezas creadas en Hubly pertenecen íntegramente al usuario o a su agencia. Hubly no reclama derechos de propiedad ni licencias comerciales sobre el material que almacenas.",
  },
  {
    id: "transparencia",
    title: "3. Transparencia operativa y exportación sin bloqueos",
    body: "Cada función disponible en Hubly opera sobre datos reales verificables, sin botones simulados ni bloqueos artificiales. Puedes exportar tu información en formatos estándar (.json y .md) en cualquier momento.",
  },
  {
    id: "uso-responsable",
    title: "4. Uso responsable y seguridad de la cuenta",
    body: "Eres responsable de mantener la confidencialidad de tus credenciales de acceso y de utilizar el servicio conforme a la ley vigente, respetando el aislamiento entre espacios de trabajo.",
  },
] as const;

export function TermsPage() {
  return (
    <LegalPage
      eyebrow="Condiciones de uso claras"
      title="Términos de Servicio"
      intro="Reglas claras sobre el uso de Hubly, la titularidad de tu contenido y nuestros compromisos operativos."
      sections={TERMS_SECTIONS}
      current="/terminos"
    />
  );
}

export default TermsPage;

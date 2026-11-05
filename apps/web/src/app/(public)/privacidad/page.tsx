import { LegalPage } from "@hubly/ui";

const PRIVACY_SECTIONS = [
  {
    id: "soberania",
    title: "1. Titularidad y soberanía de los datos",
    body: "Tus datos pertenecen íntegramente a tu agencia y a tus usuarios. Hubly actúa únicamente como custodio operativo: nunca vendemos, alquilamos ni compartimos tus notas, pendientes o piezas editoriales con terceros con fines publicitarios ni de perfilado comercial.",
  },
  {
    id: "aislamiento-rls",
    title: "2. Aislamiento estricto por espacio de trabajo (RLS)",
    body: "Cada espacio de trabajo está protegido mediante políticas de seguridad a nivel de fila (Row-Level Security, RLS) directamente en PostgreSQL. Ninguna cuenta ajena puede leer, listar ni modificar registros privados o pertenecientes a otra agencia.",
  },
  {
    id: "portabilidad",
    title: "3. Portabilidad y exportación abierta desde el primer día",
    body: "Tus datos nunca quedan cautivos. En cualquier momento puedes descargar todas tus notas y pendientes en formatos abiertos estándar (.json y .md) directamente desde la vista Hoy (/hoy), sin bloqueos ni trámites.",
  },
  {
    id: "retencion",
    title: "4. Retención y eliminación bajo tu control",
    body: "Mantienes control directo sobre las notas y pendientes creados en tu espacio. Puedes editar, archivar o solicitar la baja definitiva de tu espacio de trabajo junto con todos sus registros asociados.",
  },
] as const;

export function PrivacyPage() {
  return (
    <LegalPage
      eyebrow="Privacidad y soberanía de datos"
      title="Política de Privacidad"
      intro="Cómo protegemos, aislamos y garantizamos la portabilidad de la información de tu agencia en Hubly."
      sections={PRIVACY_SECTIONS}
      current="/privacidad"
    />
  );
}

export default PrivacyPage;

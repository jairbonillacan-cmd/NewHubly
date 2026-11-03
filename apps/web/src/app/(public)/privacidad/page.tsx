import { GlassCard, HublySymbol, PillNav, ThemeToggle, tokens } from "@hubly/ui";

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
    <div style={{ minHeight: tokens.layout.viewportHeight, backgroundColor: tokens.color.surfaceCanvas, color: tokens.color.textPrimary, display: "flex", flexDirection: "column" }}>
      <section aria-label="Encabezado de política de privacidad" style={{ position: "relative", backgroundColor: tokens.color.surfaceBrand, color: tokens.color.surfaceBrandContrast, paddingTop: tokens.space[12], paddingBottom: tokens.space[10], paddingInline: tokens.space[4] }}>
        <PillNav
          brandHref="/"
          navLinks={[
            { href: "/", label: "Inicio" },
            { href: "/hoy", label: "Vista Hoy" },
            { href: "/privacidad", label: "Privacidad", active: true },
            { href: "/terminos", label: "Términos" },
          ]}
          actionsSlot={<ThemeToggle />}
        />
        <div className="hubly-hero-content" style={{ maxWidth: tokens.layout.readingWidth, marginInline: "auto", paddingTop: tokens.space[8], display: "flex", flexDirection: "column", gap: tokens.space[3] }}>
          <span style={{ fontSize: tokens.font.size.xs, fontWeight: tokens.font.weight.semibold, letterSpacing: tokens.font.tracking.wider, textTransform: "uppercase", color: tokens.color.surfaceBrandMuted }}>
            Privacidad y soberanía de datos
          </span>
          <h1 style={{ margin: tokens.space[0], fontSize: tokens.font.size["3xl"], lineHeight: tokens.font.leading.tight, fontWeight: tokens.font.weight.bold, color: tokens.color.surfaceBrandContrast }}>
            Política de Privacidad
          </h1>
          <p style={{ margin: tokens.space[0], fontSize: tokens.font.size.base, lineHeight: tokens.font.leading.relaxed, color: tokens.color.surfaceBrandMuted }}>
            Cómo protegemos, aislamos y garantizamos la portabilidad de la información de tu agencia en Hubly.
          </p>
        </div>
      </section>

      <main style={{ flex: 1, width: "100%", maxWidth: tokens.layout.readingWidth, marginInline: "auto", paddingBlock: tokens.space[10], paddingInline: tokens.space[4], display: "flex", flexDirection: "column", gap: tokens.space[5] }}>
        {PRIVACY_SECTIONS.map((s) => (
          <GlassCard key={s.id} as="section" aria-labelledby={`heading-${s.id}`} style={{ backgroundColor: tokens.bento.cardBg, border: `${tokens.border.thin} solid ${tokens.bento.cardBorder}`, boxShadow: tokens.bento.cardShadow, color: tokens.color.textPrimary }}>
            <h2 id={`heading-${s.id}`} style={{ margin: tokens.space[0], fontSize: tokens.font.size.xl, fontWeight: tokens.font.weight.semibold, color: tokens.color.textPrimary }}>
              {s.title}
            </h2>
            <p style={{ margin: tokens.space[0], fontSize: tokens.font.size.base, lineHeight: tokens.font.leading.relaxed, color: tokens.color.textSecondary }}>
              {s.body}
            </p>
          </GlassCard>
        ))}
      </main>

      <footer role="contentinfo" style={{ borderTop: `${tokens.border.thin} solid ${tokens.color.borderDefault}`, backgroundColor: tokens.color.surfaceSubtle, paddingBlock: tokens.space[6], paddingInline: tokens.space[4] }}>
        <nav aria-label="Navegación legal y de pie de página" style={{ maxWidth: tokens.layout.readingWidth, marginInline: "auto", display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: tokens.space[4] }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: tokens.space[2], fontSize: tokens.font.size.sm, color: tokens.color.textSecondary }}><HublySymbol size={16} decorative />Hubly — Claridad operativa para agencias</span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: tokens.space[4], fontSize: tokens.font.size.sm }}>
            <a href="/" style={{ color: tokens.color.accentPrimary, fontWeight: tokens.font.weight.medium }}>Volver al inicio</a>
            <a href="/hoy" style={{ color: tokens.color.accentPrimary, fontWeight: tokens.font.weight.medium }}>Ir a Hoy</a>
            <a href="/privacidad" aria-current="page" style={{ color: tokens.color.textPrimary, fontWeight: tokens.font.weight.semibold }}>Privacidad</a>
            <a href="/terminos" style={{ color: tokens.color.accentPrimary, fontWeight: tokens.font.weight.medium }}>Términos</a>
          </div>
        </nav>
      </footer>
    </div>
  );
}

export default PrivacyPage;

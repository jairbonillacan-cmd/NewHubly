import { GlassCard, HublySymbol, PillNav, ThemeToggle, tokens } from "@hubly/ui";

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
    <div style={{ minHeight: tokens.layout.viewportHeight, backgroundColor: tokens.color.surfaceCanvas, color: tokens.color.textPrimary, display: "flex", flexDirection: "column" }}>
      <section aria-label="Encabezado de términos de servicio" style={{ position: "relative", backgroundColor: tokens.color.surfaceBrand, color: tokens.color.surfaceBrandContrast, paddingTop: tokens.space[12], paddingBottom: tokens.space[10], paddingInline: tokens.space[4] }}>
        <PillNav
          brandHref="/"
          navLinks={[
            { href: "/", label: "Inicio" },
            { href: "/hoy", label: "Vista Hoy" },
            { href: "/privacidad", label: "Privacidad" },
            { href: "/terminos", label: "Términos", active: true },
          ]}
          actionsSlot={<ThemeToggle />}
        />
        <div className="hubly-hero-content" style={{ maxWidth: tokens.layout.readingWidth, marginInline: "auto", paddingTop: tokens.space[8], display: "flex", flexDirection: "column", gap: tokens.space[3] }}>
          <span style={{ fontSize: tokens.font.size.xs, fontWeight: tokens.font.weight.semibold, letterSpacing: tokens.font.tracking.wider, textTransform: "uppercase", color: tokens.color.surfaceBrandMuted }}>
            Condiciones de uso claras
          </span>
          <h1 style={{ margin: tokens.space[0], fontSize: tokens.font.size["3xl"], lineHeight: tokens.font.leading.tight, fontWeight: tokens.font.weight.bold, color: tokens.color.surfaceBrandContrast }}>
            Términos de Servicio
          </h1>
          <p style={{ margin: tokens.space[0], fontSize: tokens.font.size.base, lineHeight: tokens.font.leading.relaxed, color: tokens.color.surfaceBrandMuted }}>
            Reglas claras sobre el uso de Hubly, la titularidad de tu contenido y nuestros compromisos operativos.
          </p>
        </div>
      </section>

      <main style={{ flex: 1, width: "100%", maxWidth: tokens.layout.readingWidth, marginInline: "auto", paddingBlock: tokens.space[10], paddingInline: tokens.space[4], display: "flex", flexDirection: "column", gap: tokens.space[5] }}>
        {TERMS_SECTIONS.map((s) => (
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
            <a href="/privacidad" style={{ color: tokens.color.accentPrimary, fontWeight: tokens.font.weight.medium }}>Privacidad</a>
            <a href="/terminos" aria-current="page" style={{ color: tokens.color.textPrimary, fontWeight: tokens.font.weight.semibold }}>Términos</a>
          </div>
        </nav>
      </footer>
    </div>
  );
}

export default TermsPage;

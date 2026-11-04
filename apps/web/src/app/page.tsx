import { BentoSection, HeroSection, HublyWordmark, PillNav, ThemeToggle, tokens } from "@hubly/ui";

const HERO_UNSPLASH_IMAGE =
  "https://images.unsplash.com/photo-1542744094-3a31f272c490?auto=format&fit=crop&w=1600&q=80";

const FOOTER_LINKS = [
  { href: "/hoy", label: "Vista Hoy" },
  { href: "/login", label: "Iniciar sesión" },
  { href: "#hero", label: "Inicio" },
  { href: "#ciclo", label: "El Ciclo" },
  { href: "#pregunta", label: "¿Quién lo tiene?" },
  { href: "#hoy", label: "Módulo Hoy" },
  { href: "/privacidad", label: "Privacidad" },
  { href: "/terminos", label: "Términos" },
] as const;

export default function HomePage() {
  return (
    <div style={{ position: "relative", minHeight: tokens.layout.viewportHeight, backgroundColor: tokens.bento.surfaceBase, color: tokens.color.textPrimary, fontFamily: tokens.font.sans, width: "100%", boxSizing: "border-box" }}>
      <PillNav
        actionsSlot={
          <>
            <a href="/login" style={{ display: "inline-flex", alignItems: "center", paddingBlock: tokens.space[2], paddingInline: tokens.space[3], backgroundColor: tokens.pill.glassBg, color: tokens.pill.glassText, border: `${tokens.border.thin} solid ${tokens.pill.glassBorder}`, borderRadius: tokens.radius.full, fontSize: tokens.font.size.xs, fontWeight: tokens.font.weight.semibold, textDecoration: "none", whiteSpace: "nowrap" }}>
              Iniciar sesión
            </a>
            <a href="/hoy" style={{ display: "inline-flex", alignItems: "center", gap: tokens.space[1], paddingBlock: tokens.space[2], paddingInline: tokens.space[3], backgroundColor: tokens.pill.activeBg, color: tokens.pill.activeText, border: `${tokens.border.thin} solid ${tokens.pill.glassBorder}`, borderRadius: tokens.radius.full, fontSize: tokens.font.size.xs, fontWeight: tokens.font.weight.semibold, textDecoration: "none", whiteSpace: "nowrap" }}>
              <span>Ir a Hoy</span>
              <span aria-hidden="true">→</span>
            </a>
            <ThemeToggle />
          </>
        }
      />

      <main>
        <HeroSection imageSrc={HERO_UNSPLASH_IMAGE} />

        <BentoSection />

        <section aria-labelledby="cta-hoy-heading" style={{ backgroundColor: tokens.bento.surfaceBase, color: tokens.color.textPrimary, paddingBottom: tokens.space[12], paddingInline: tokens.space[4], width: "100%", boxSizing: "border-box" }}>
          <div style={{ width: "100%", maxWidth: tokens.layout.bentoWidth, marginInline: "auto", backgroundColor: tokens.color.surfaceBrand, color: tokens.color.surfaceBrandContrast, border: `${tokens.border.thin} solid ${tokens.bento.cardBorder}`, borderRadius: tokens.radius["2xl"], padding: tokens.space[8], display: "flex", flexDirection: "column", gap: tokens.space[5], boxSizing: "border-box" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: tokens.space[2] }}>
              <span aria-hidden="true" style={{ width: tokens.space[2], height: tokens.space[2], borderRadius: tokens.radius.full, backgroundColor: tokens.color.accentPrimary }} />
              <span style={{ fontSize: tokens.font.size.xs, fontWeight: tokens.font.weight.bold, textTransform: "uppercase", letterSpacing: tokens.font.tracking.widest, color: tokens.color.surfaceBrandMuted }}>
                Espacio de trabajo operativo
              </span>
            </div>

            <h2 id="cta-hoy-heading" style={{ margin: tokens.space[0], fontSize: tokens.font.size["3xl"], fontWeight: tokens.font.weight.bold, lineHeight: tokens.font.leading.tight, letterSpacing: tokens.font.tracking.tight, color: tokens.color.surfaceBrandContrast }}>
              Empieza hoy con tus notas y pendientes
            </h2>

            <p style={{ margin: tokens.space[0], fontSize: tokens.font.size.base, lineHeight: tokens.font.leading.relaxed, color: tokens.color.surfaceBrandMuted, maxWidth: tokens.layout.readingWidth }}>
              Ordena el ciclo real de una pieza y responde al instante ¿quién tiene el turno? sin dispersar acuerdos en chats. Captura ideas en una línea, prioriza tus entregas diarias y conserva tus datos en formatos abiertos.
            </p>

            <div style={{ display: "flex", alignItems: "center", gap: tokens.space[4], flexWrap: "wrap", paddingTop: tokens.space[2] }}>
              <a href="/hoy" style={{ display: "inline-flex", alignItems: "center", gap: tokens.space[2], paddingBlock: tokens.space[3], paddingInline: tokens.space[6], backgroundColor: tokens.color.accentPrimary, color: tokens.color.textOnAccent, borderRadius: tokens.radius.full, fontWeight: tokens.font.weight.bold, fontSize: tokens.font.size.sm, textDecoration: "none" }}>
                <span>Entrar a Hoy</span>
                <span aria-hidden="true">→</span>
              </a>
              <a href="/login" style={{ display: "inline-flex", alignItems: "center", paddingBlock: tokens.space[3], paddingInline: tokens.space[6], backgroundColor: tokens.pill.glassBg, color: tokens.color.surfaceBrandContrast, border: `${tokens.border.thin} solid ${tokens.pill.glassBorder}`, borderRadius: tokens.radius.full, fontWeight: tokens.font.weight.semibold, fontSize: tokens.font.size.sm, textDecoration: "none" }}>
                Crear cuenta o iniciar sesión
              </a>
              <a href="#ciclo" style={{ display: "inline-flex", alignItems: "center", paddingBlock: tokens.space[3], paddingInline: tokens.space[6], backgroundColor: tokens.pill.glassBg, color: tokens.color.surfaceBrandContrast, border: `${tokens.border.thin} solid ${tokens.pill.glassBorder}`, borderRadius: tokens.radius.full, fontWeight: tokens.font.weight.semibold, fontSize: tokens.font.size.sm, textDecoration: "none" }}>
                Ver las 7 etapas del ciclo
              </a>
            </div>
          </div>
        </section>
      </main>

      <footer role="contentinfo" style={{ backgroundColor: tokens.color.surfaceRaised, color: tokens.color.textSecondary, borderTop: `${tokens.border.thin} solid ${tokens.color.borderSubtle}`, paddingBlock: tokens.space[10], paddingInline: tokens.space[4], width: "100%", boxSizing: "border-box" }}>
        <div style={{ width: "100%", maxWidth: tokens.layout.bentoWidth, marginInline: "auto", display: "flex", flexDirection: "column", gap: tokens.space[6], boxSizing: "border-box" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: tokens.space[6] }}>
            <div style={{ display: "flex", flexDirection: "column", gap: tokens.space[2], maxWidth: tokens.layout.readingWidth }}>
              <a href="/" aria-label="Hubly" style={{ display: "inline-flex", alignItems: "center", color: tokens.color.textPrimary, textDecoration: "none" }}>
                <HublyWordmark height={20} ariaLabel="Hubly" />
              </a>
              <p style={{ margin: tokens.space[0], fontSize: tokens.font.size.xs, lineHeight: tokens.font.leading.relaxed, color: tokens.color.textSecondary }}>
                Sistema de trabajo editorial para agencias de redes sociales. Claridad operativa sobre qué sigue y quién tiene cada pieza.
              </p>
            </div>

            <nav aria-label="Enlaces del pie de página">
              <ul style={{ display: "flex", flexWrap: "wrap", gap: tokens.space[4], listStyle: "none", margin: tokens.space[0], padding: tokens.space[0] }}>
                {FOOTER_LINKS.map((item) => (
                  <li key={item.href}>
                    <a href={item.href} style={{ fontSize: tokens.font.size.xs, fontWeight: tokens.font.weight.medium, color: tokens.color.textPrimary, textDecoration: "none" }}>
                      {item.label}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          </div>

          <div style={{ borderTop: `${tokens.border.thin} solid ${tokens.color.borderSubtle}`, paddingTop: tokens.space[4], display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: tokens.space[3], fontSize: tokens.font.size.xs, color: tokens.color.textMuted }}>
            <span>
              Fotografía editorial: Campaign Creators (@campaign_creators, ID pypeCEaJeZY) y Annie Spratt (@anniespratt, ID MChSQHxGZrQ) bajo Unsplash License.
            </span>
            <span>Hubly · Soberanía de datos para tu agencia</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

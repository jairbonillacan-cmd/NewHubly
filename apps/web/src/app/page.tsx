import { tokens } from "@hubly/ui";

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: tokens.layout.viewportHeight,
        backgroundColor: tokens.color.surfaceCanvas,
        color: tokens.color.textPrimary,
        paddingBlock: tokens.space[10],
        paddingInline: tokens.space[4],
      }}
    >
      <div
        style={{
          maxWidth: tokens.layout.readingWidth,
          marginInline: "auto",
          display: "flex",
          flexDirection: "column",
          gap: tokens.space[6],
        }}
      >
        <header
          style={{
            display: "flex",
            flexDirection: "column",
            gap: tokens.space[2],
            paddingBottom: tokens.space[5],
            borderBottom: `${tokens.border.thin} solid ${tokens.color.borderSubtle}`,
          }}
        >
          <h1 style={{ margin: tokens.space[0], fontSize: tokens.font.size["2xl"], lineHeight: tokens.font.leading.tight, fontWeight: tokens.font.weight.semibold, color: tokens.color.textPrimary }}>
            Hubly
          </h1>
          <p style={{ margin: tokens.space[0], fontSize: tokens.font.size.base, lineHeight: tokens.font.leading.relaxed, color: tokens.color.textSecondary }}>
            Sistema de trabajo para agencias de redes sociales.
          </p>
        </header>

        <section
          aria-labelledby="heading-hoy"
          style={{
            backgroundColor: tokens.color.surfaceRaised,
            border: `${tokens.border.thin} solid ${tokens.color.borderDefault}`,
            borderRadius: tokens.radius.md,
            padding: tokens.space[5],
            display: "flex",
            flexDirection: "column",
            gap: tokens.space[2],
          }}
        >
          <h2 id="heading-hoy" style={{ margin: tokens.space[0], fontSize: tokens.font.size.lg, lineHeight: tokens.font.leading.tight, fontWeight: tokens.font.weight.semibold, color: tokens.color.textPrimary }}>
            Hoy
          </h2>
          <p style={{ margin: tokens.space[0], fontSize: tokens.font.size.sm, lineHeight: tokens.font.leading.relaxed, color: tokens.color.textSecondary }}>
            Todavía no hay nada que hacer aquí. La primera entrega es Notas y pendientes.
          </p>
        </section>
      </div>
    </main>
  );
}

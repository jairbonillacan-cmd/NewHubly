const HERO_POINTS = [
  { title: "Tu día en una lista", note: "Lo vencido primero", tone: "bg-(--tint-blue) text-(--accent-primary)", icon: "M9 6h11M9 12h11M9 18h11M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2" },
  { title: "Cada quien con lo suyo", note: "Tu equipo, muy pronto", tone: "bg-(--tint-green) text-(--status-success-text)", icon: "M9 4.5a3.5 3.5 0 1 0 0 7a3.5 3.5 0 1 0 0-7M2.5 20c.8-3.5 3.3-5.5 6.5-5.5s5.7 2 6.5 5.5M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5c2 .6 3.2 2.5 3.5 5.5" },
  { title: "El cliente aprueba en el celular", note: "Próximamente", tone: "bg-(--tint-sand) text-(--status-warning-text)", icon: "M9.5 2.5h5a2.5 2.5 0 0 1 2.5 2.5v14a2.5 2.5 0 0 1-2.5 2.5h-5A2.5 2.5 0 0 1 7 19V5a2.5 2.5 0 0 1 2.5-2.5M10 13l1.5 1.5L14.5 11" },
] as const;

/** Titular, llamadas a la acción y tres beneficios del landing (#85), con entrada escalonada y subrayado que se dibuja. */
export function LandingHero() {
  return (
    <section aria-labelledby="landing-titulo" className="flex flex-col items-center px-4 pt-14 text-center lg:pt-20">
      <h1
        id="landing-titulo"
        className="hubly-enter m-0 max-w-4xl text-(length:--text-display-hero) leading-none font-bold tracking-(--tracking-tightest) text-(--text-primary)"
      >
        Deja de preguntar{" "}
        <span className="relative inline-block whitespace-nowrap">
          «¿quién tiene esto?»
          <svg viewBox="0 0 600 16" preserveAspectRatio="none" aria-hidden="true" className="absolute -bottom-2.5 left-0 h-3 w-full lg:h-4">
            <path className="hubly-draw" pathLength={1} d="M4 10 C150 2 300 14 596 6" fill="none" stroke="var(--accent-primary)" strokeWidth="6" strokeLinecap="round" />
          </svg>
        </span>
      </h1>
      <p className="hubly-enter mt-7 mb-0 max-w-xl text-lg leading-relaxed text-(--text-secondary) lg:text-xl" data-delay="1">
        Hubly junta las ideas, los pendientes y las aprobaciones de cada cliente. Abres y ya sabes qué sigue y quién lo tiene.
      </p>
      <div className="hubly-enter mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row" data-delay="2">
        <a
          href="/login"
          className="group inline-flex h-13 items-center justify-center gap-2.5 rounded-full bg-(--accent-primary) px-7 text-base font-semibold text-(--text-on-accent) no-underline transition-transform hover:bg-(--accent-primary-hover) active:scale-95"
        >
          Crear cuenta
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className="transition-transform group-hover:translate-x-1">
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
        </a>
        <a
          href="#producto"
          className="inline-flex h-13 items-center justify-center rounded-full border border-(--border-default) bg-(--surface-raised) px-7 text-base font-semibold text-(--text-primary) no-underline transition-transform hover:bg-(--surface-subtle) active:scale-95"
        >
          Ver cómo funciona
        </a>
      </div>
      <p className="hubly-enter mt-4 mb-0 text-sm text-(--text-muted)" data-delay="2">Hoy ya puedes usar tu espacio personal. Lo de equipo llega por partes.</p>

      <ul className="hubly-enter m-0 mt-12 hidden w-full max-w-3xl list-none grid-cols-3 gap-10 p-0 md:grid" data-delay="3">
        {HERO_POINTS.map((point) => (
          <li key={point.title} className="group flex flex-col items-center gap-2.5">
            <span className={`flex size-11 items-center justify-center rounded-xl transition-transform group-hover:-translate-y-1 group-hover:rotate-6 ${point.tone}`}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d={point.icon} />
              </svg>
            </span>
            <span className="text-base font-semibold text-(--text-primary)">{point.title}</span>
            <span className="text-sm text-(--text-muted)">{point.note}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

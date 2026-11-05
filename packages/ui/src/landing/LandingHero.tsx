import { AppPreview } from "./AppPreview";

export function LandingHero() {
  return (
    <section aria-labelledby="landing-titulo" data-landing-section="hero" className="px-4 pt-12 text-center lg:pt-20">
      <div className="mx-auto max-w-(--landing-width)">
        <p className="mx-auto mb-5 w-fit rounded-full bg-(--status-success-bg) px-4 py-2 text-xs font-semibold text-(--status-success-text)">
          <span aria-hidden="true">● </span>Ya disponible: tu espacio personal
        </p>
        <h1 id="landing-titulo" className="landing-display mx-auto max-w-5xl text-(length:--landing-hero-size) leading-none font-normal tracking-(--tracking-tighter)">
          Deja de preguntar <em className="block text-(--landing-accent-text)">«¿quién tiene esto?»</em>
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-(--text-secondary) lg:mt-6 lg:text-lg">
          Hubly junta las ideas, los pendientes y las aprobaciones de cada cliente. Abres y ya sabes qué sigue y quién lo tiene.
        </p>
        <div className="mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <a href="/login" className="inline-flex min-h-12 items-center justify-center rounded-full bg-(--accent-primary) px-6 font-semibold text-(--text-on-accent) hover:underline">Crear cuenta →</a>
          <a href="#producto" className="inline-flex min-h-12 items-center justify-center rounded-full border border-(--text-primary) px-6 font-semibold hover:bg-(--landing-ice)">Ver cómo funciona</a>
        </div>
        <p className="mt-4 text-sm text-(--text-muted)">Hoy ya puedes usar tu espacio personal. Lo de equipo llega por partes.</p>
        <AppPreview />
      </div>
    </section>
  );
}

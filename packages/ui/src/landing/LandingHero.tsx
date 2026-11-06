import { AppPreview } from "./AppPreview";

export function LandingHero() {
  return (
    <section aria-labelledby="landing-titulo" data-landing-section="hero" className="px-4 pt-12 text-center lg:pt-20">
      <div className="mx-auto max-w-(--landing-width)">
        <p data-delay="1" className="hubly-enter mx-auto mb-5 w-fit rounded-full bg-(--status-success-bg) px-4 py-2 text-xs font-semibold text-(--status-success-text)">
          <span aria-hidden="true">● </span>Ya disponible: tu espacio personal
        </p>
        <h1 id="landing-titulo" data-delay="2" className="landing-display hubly-enter mx-auto max-w-5xl text-(length:--landing-hero-size) leading-none font-normal tracking-(--tracking-tighter)">
          Un solo espacio para <em className="block text-(--landing-accent-text)"><span className="hubly-underline box-decoration-clone">todo tu marketing.</span></em>
        </h1>
        <p data-delay="3" className="hubly-enter mx-auto mt-5 max-w-xl text-base leading-relaxed text-(--text-secondary) lg:mt-6 lg:text-lg">
          Organiza tus ideas, tu contenido y tus marcas en el mismo lugar. Trabaja por tu cuenta o con tu equipo, sin repartir todo entre tantas herramientas.
        </p>
        <div data-delay="3" className="hubly-enter mt-7 flex flex-col justify-center gap-3 sm:flex-row">
          <a href="/login?modo=registro" className="inline-flex min-h-12 items-center justify-center rounded-full bg-(--accent-primary) px-6 font-semibold text-(--text-on-accent) hover:underline">Empezar con Hubly →</a>
          <a href="#producto" className="inline-flex min-h-12 items-center justify-center rounded-full border border-(--text-primary) px-6 font-semibold hover:bg-(--landing-ice)">Ver cómo funciona</a>
        </div>
        <p data-delay="4" className="hubly-enter mt-4 text-sm text-(--text-muted)">Hoy ya puedes organizar tus ideas y pendientes. Lo demás llega por partes.</p>
        <div data-delay="4" className="hubly-enter">
          <AppPreview />
        </div>
      </div>
    </section>
  );
}

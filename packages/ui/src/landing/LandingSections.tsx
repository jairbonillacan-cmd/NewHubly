import { Hubi } from "../components/brand/Hubi";
import { Icon } from "../espacio/icons";
import { LandingFaq } from "./FaqAccordion";

export { PainSection } from "./PainSection";
export { LandingFooter, DEFAULT_FOOTER_LINKS } from "./LandingFooter";
export { LANDING_FAQ } from "./FaqAccordion";

const DATA_POINTS = [
  ["Privado hasta que lo compartas", "Nadie más ve tus notas si no lo decides tú. Lo comprobamos contra la base de datos real."],
  ["Te lo llevas cuando quieras", "Exportas todo en JSON o Markdown, en un clic."],
  ["Tu hora, tu «hoy»", "Lo que vence hoy, vence en tu día, estés donde estés."],
] as const;

export function DataSection() {
  return (
    <section id="privacidad" aria-labelledby="privacidad-titulo" data-landing-section="privacidad" className="mx-auto max-w-(--landing-width) scroll-mt-6 px-4 pt-20 lg:pt-28">
      <div className="grid items-center gap-8 rounded-(--landing-panel-radius) bg-(--landing-paper) px-5 py-12 lg:grid-cols-2 lg:gap-12 lg:px-12">
        <div>
          <p className="mb-3 text-xs font-bold tracking-(--tracking-widest) text-(--landing-accent-text) uppercase">Privacidad</p>
          <h2 id="privacidad-titulo" className="landing-display text-4xl leading-none font-normal tracking-(--tracking-tight) lg:text-5xl">Tus datos son tuyos.</h2>
          <ol className="mt-6 grid gap-4">
            {DATA_POINTS.map(([title, body], index) => (
              <li key={title} className="grid grid-cols-[auto_1fr] gap-3">
                <span aria-hidden="true" className="grid size-8 place-items-center rounded-full bg-(--landing-ice) text-sm font-semibold text-(--landing-accent-text)">{index + 1}</span>
                <div>
                  <h3 className="landing-display text-xl leading-tight font-medium">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-(--text-secondary)">{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
        <div aria-hidden="true" className="min-w-0 rounded-3xl bg-(--landing-card) p-5 shadow-(--landing-shadow) lg:p-7">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-xl bg-(--landing-ice) text-(--landing-accent-text)"><Icon name="descargar" className="size-5" /></span>
            <p className="text-lg font-semibold">Exportar mis datos</p>
          </div>
          <p className="mt-3 text-sm text-(--text-secondary)">Todas tus notas y pendientes, con sus fechas y vínculos.</p>
          <div className="mt-4 flex flex-wrap gap-2 text-sm font-semibold text-(--landing-accent-text)">
            {["JSON", "Markdown"].map((format) => <span key={format} className="rounded-full bg-(--landing-ice) px-3 py-2">{format}</span>)}
          </div>
          <ul className="mt-4 grid gap-1.5 font-mono text-xs text-(--text-secondary)">
            {["json", "md"].map((extension) => (
              <li key={extension} className="rounded-xl bg-(--landing-row) px-3 py-2 wrap-anywhere">hubly-export-AAAA-MM-DD.{extension}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

export function FaqSection() {
  return (
    <section id="preguntas" aria-labelledby="preguntas-titulo" data-landing-section="preguntas" className="mx-auto grid max-w-(--landing-width) scroll-mt-6 gap-6 px-4 pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-14 lg:pt-28">
      <div className="grid content-start gap-3">
        <p className="text-xs font-bold tracking-(--tracking-widest) text-(--landing-accent-text) uppercase">Preguntas</p>
        <h2 id="preguntas-titulo" className="landing-display text-4xl leading-none font-normal tracking-(--tracking-tight) lg:text-5xl">Lo que nos preguntan.</h2>
        <p className="max-w-sm leading-relaxed text-(--text-secondary)">Respuestas cortas y honestas. Si algo no está listo, lo decimos.</p>
        <div className="mt-2 hidden lg:block">
          <Hubi acabado="volumen" tamano={144} decorativo priority="deferred" className="size-36" sizing="css" />
        </div>
      </div>
      <LandingFaq />
    </section>
  );
}

export function FinalCta() {
  return (
    <section aria-labelledby="cta-titulo" data-landing-section="cierre" className="mx-auto max-w-(--landing-width) px-4 pt-16 pb-12 lg:pt-24 lg:pb-18">
      <div className="grid items-center gap-4 rounded-(--landing-end-radius) border border-(--landing-end-border) bg-(--landing-end) px-6 py-11 text-(--landing-on-end) lg:grid-cols-[minmax(0,1.7fr)_1fr] lg:gap-8 lg:px-14 lg:py-9">
        <div>
          <h2 id="cta-titulo" className="landing-display text-4xl leading-none font-normal tracking-(--tracking-tight) lg:text-6xl">Empieza con tu día de hoy.</h2>
          <p className="mt-4 text-(--landing-end-muted) lg:text-lg">Crea tu cuenta y ten tus pendientes en orden en un minuto.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a href="/login" className="inline-flex min-h-12 items-center justify-center rounded-full bg-(--landing-on-end) px-6 font-semibold text-(--landing-end) hover:underline">Crear cuenta</a>
            <a href="/login" className="inline-flex min-h-12 items-center justify-center rounded-full border border-(--landing-on-end) px-6 font-semibold hover:underline">Ya tengo cuenta</a>
          </div>
        </div>
        <div className="justify-self-center">
          <Hubi acabado="volumen" pose="laptop" tamano={280} decorativo priority="deferred" className="size-45 lg:size-70" sizing="css" />
        </div>
      </div>
    </section>
  );
}

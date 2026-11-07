import { Hubi } from "../components/brand/Hubi";
import { Icon } from "../espacio/icons";
import { LandingFaq } from "./FaqAccordion";
import { Reveal } from "./Reveal";

export { PainSection } from "./PainSection";
export { LandingFooter, DEFAULT_FOOTER_LINKS } from "./LandingFooter";
export { LANDING_FAQ } from "./FaqAccordion";

const DATA_POINTS = [
  ["Lo privado es privado", "Tus notas solo las ve quien tú decidas. Ni otro cliente ni otra agencia."],
  ["Si un día te vas, te lo llevas", "Descargas todo lo que escribiste cuando quieras, sin pedir permiso."],
  ["Tu día empieza a tu hora", "Lo que vence hoy vence en tu día, aunque trabajes desde otra ciudad."],
] as const;

export function DataSection() {
  return (
    <section id="privacidad" aria-labelledby="privacidad-titulo" data-landing-section="privacidad" className="mx-auto max-w-(--landing-width) scroll-mt-6 px-4 pt-20 lg:pt-28">
      <Reveal className="relative grid items-center gap-8 rounded-(--landing-panel-radius) bg-(--landing-paper) px-5 py-12 lg:grid-cols-2 lg:gap-12 lg:px-12">
        <div aria-hidden="true" className="hubly-peek absolute -top-14 right-6 lg:right-12">
          <Hubi pose="privacidad" tamano={112} decorativo priority="deferred" className="hubly-wiggle size-24 lg:size-28" sizing="css" />
        </div>
        <div>
          <p className="mb-3 text-xs font-bold tracking-(--tracking-widest) text-(--landing-accent-text) uppercase">Tranquilidad</p>
          <h2 id="privacidad-titulo" className="landing-display text-4xl leading-none font-normal tracking-(--tracking-tight) lg:text-5xl">Lo de tus clientes se queda contigo.</h2>
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
          <p className="text-xs text-(--text-muted)">Nota · Café Aurora</p>
          <p className="mt-1 text-lg font-semibold">Brief de la campaña de invierno</p>
          <p className="mt-4 text-sm font-semibold">¿Quién la ve?</p>
          <ul className="mt-2 grid gap-2 text-sm">
            <li className="flex items-center gap-3 rounded-xl border-2 border-(--accent-primary) bg-(--landing-ice) px-3 py-2.5">
              <Icon name="candado" className="size-5 text-(--landing-accent-text)" /><span className="grow font-semibold">Solo tú</span><span className="text-xs text-(--landing-accent-text)">Elegido</span>
            </li>
            <li className="flex items-center gap-3 rounded-xl bg-(--landing-row) px-3 py-2.5">
              <Icon name="compartir" className="size-5 text-(--text-secondary)" /><span className="grow">Tu equipo de la agencia</span>
            </li>
          </ul>
          <p className="mt-4 text-xs text-(--text-muted)">Compartir con el equipo · Muy pronto</p>
        </div>
      </Reveal>
    </section>
  );
}

export function FaqSection() {
  return (
    <section id="preguntas" aria-labelledby="preguntas-titulo" data-landing-section="preguntas" className="mx-auto grid max-w-(--landing-width) scroll-mt-6 gap-6 px-4 pt-20 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] lg:gap-14 lg:pt-28">
      <div className="grid content-start gap-3">
        <p className="text-xs font-bold tracking-(--tracking-widest) text-(--landing-accent-text) uppercase">Preguntas</p>
        <h2 id="preguntas-titulo" className="landing-display text-4xl leading-none font-normal tracking-(--tracking-tight) lg:text-5xl">Lo que nos preguntan.</h2>
        <p className="max-w-sm leading-relaxed text-(--text-secondary)">Respuestas cortas. Si algo no está listo, te lo decimos.</p>
        <div className="mt-2 hidden lg:block">
          <Hubi acabado="volumen" tamano={144} decorativo priority="deferred" className="hubly-wiggle size-36" sizing="css" />
        </div>
      </div>
      <LandingFaq />
    </section>
  );
}

export function FinalCta() {
  return (
    <section aria-labelledby="cta-titulo" data-landing-section="cierre" className="mx-auto max-w-(--landing-width) px-4 pt-16 pb-12 lg:pt-24 lg:pb-18">
      <Reveal className="grid items-center gap-4 rounded-(--landing-end-radius) border border-(--landing-end-border) bg-(--landing-end) px-6 py-11 text-(--landing-on-end) lg:grid-cols-[minmax(0,1.7fr)_1fr] lg:gap-8 lg:px-14 lg:py-9">
        <div>
          <h2 id="cta-titulo" className="landing-display text-4xl leading-none font-normal tracking-(--tracking-tight) lg:text-6xl">Tu marketing tiene su lugar.</h2>
          <p className="mt-4 text-(--landing-end-muted) lg:text-lg">Organiza tu trabajo y empieza desde Hubly.</p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row">
            <a href="/registro" className="inline-flex min-h-12 items-center justify-center rounded-full bg-(--landing-on-end) px-6 font-semibold text-(--landing-end) hover:underline">Empezar con Hubly</a>
            <a href="/login" className="inline-flex min-h-12 items-center justify-center rounded-full border border-(--landing-on-end) px-6 font-semibold hover:underline">Ya tengo cuenta</a>
          </div>
        </div>
        <div className="justify-self-center">
          <Hubi pose="celebrar" tamano={280} decorativo priority="deferred" className="hubly-wiggle size-45 lg:size-70" sizing="css" />
        </div>
      </Reveal>
    </section>
  );
}

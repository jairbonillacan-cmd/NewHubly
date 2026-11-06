import { Hubi } from "../components/brand/Hubi";
import { Reveal } from "./Reveal";
import { SectionIntro } from "./SectionIntro";

const CARD = "rounded-2xl bg-(--landing-card) p-3 shadow-(--landing-shadow) lg:absolute lg:p-4";
const WAVE = [3, 6, 9, 5, 11, 7, 4, 10, 6, 3, 7, 5] as const;

export function PainSection() {
  return (
    <section aria-labelledby="problema-titulo" data-landing-section="problema" className="mx-auto max-w-(--landing-width) px-4 pt-20 lg:pt-28">
      <Reveal>
        <SectionIntro id="problema-titulo" label="El problema" title="Deja de repartir tu trabajo entre tantas herramientas." body="Las ideas en el celular, la parrilla en un Excel y los pendientes en un chat. Y al final alguien pregunta: «¿quién tiene esto?»" />
      </Reveal>
      <div className="mt-8 grid gap-4 lg:mt-11 lg:grid-cols-2 lg:gap-6">
        <Reveal retraso={1} className="h-full">
        <article className="relative h-full rounded-(--landing-panel-radius) bg-(--landing-paper) px-5 py-6 lg:px-8 lg:py-7">
          <div aria-hidden="true" className="hubly-peek absolute -top-12 right-5 lg:right-8">
            <Hubi pose="buscar" tamano={96} decorativo priority="deferred" className="hubly-wiggle size-20 lg:size-24" sizing="css" />
          </div>
          <h3 className="landing-display text-2xl font-medium lg:text-3xl">Sin Hubly</h3>
          <div aria-hidden="true" className="relative mt-5 grid gap-3 px-1 text-sm lg:min-h-76">
            <div className={`${CARD} -rotate-2 lg:top-0 lg:left-0 lg:w-3/5`}>
              <p className="text-xs font-semibold text-(--text-muted)">Grupo · Equipo Aurora</p>
              <p className="mt-1.5 font-medium">¿Alguien tiene la versión final del copy del carrusel?</p>
              <p className="mt-1.5 text-xs text-(--text-muted)">37 mensajes sin leer</p>
            </div>
            <div className={`${CARD} rotate-2 lg:top-18 lg:right-0 lg:w-3/5`}>
              <p className="font-mono text-xs font-semibold wrap-anywhere">parrilla_nov_FINAL_v3.xlsx</p>
              <div className="mt-2 grid grid-cols-3 divide-x divide-(--border-default) overflow-hidden rounded-lg border border-(--border-default) bg-(--landing-row) text-center text-xs text-(--text-secondary)">
                {["¿?", "ver chat", "pendiente"].map((cell) => <span key={cell} className="px-1 py-2">{cell}</span>)}
              </div>
            </div>
            <div className={`${CARD} flex items-center gap-2 -rotate-1.5 lg:bottom-16 lg:left-0`}>
              <svg viewBox="0 0 48 24" aria-hidden="true" className="h-6 w-12 shrink-0 text-(--border-control)">
                {WAVE.map((height, index) => <path key={index} d={`M${2 + 4 * index} ${12 - height}v${2 * height}`} stroke="currentColor" strokeWidth="2" strokeLinecap="round" />)}
              </svg>
              <span className="lg:hidden">Cambios · 4:02</span><span className="hidden lg:inline">Cambios del cliente · 4:02</span>
            </div>
            <div className="w-4/5 justify-self-end rounded-2xl bg-(--landing-note) p-3 text-(--landing-on-note) shadow-(--landing-shadow) rotate-3 lg:absolute lg:right-0 lg:bottom-2 lg:w-1/2 lg:p-4">
              Mandar fotos al estudio… ¿o ya las mandó Sofía?
            </div>
          </div>
        </article>
        </Reveal>
        <Reveal retraso={2} className="h-full">
        <article className="relative h-full rounded-(--landing-panel-radius) bg-(--landing-mist) px-5 py-6 lg:px-8 lg:py-7">
          <div aria-hidden="true" className="hubly-peek absolute -top-12 right-5 lg:right-8">
            <Hubi pose="bienvenida" tamano={96} decorativo priority="deferred" className="hubly-wiggle size-20 lg:size-24" sizing="css" />
          </div>
          <h3 className="landing-display text-2xl font-medium lg:text-3xl">Con Hubly</h3>
          <div aria-hidden="true" className="mt-5 rounded-3xl bg-(--landing-card) p-4 shadow-(--landing-shadow) lg:p-6">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="text-(--text-muted)">Café Aurora · Instagram</span>
              <span className="rounded-full bg-(--landing-ice) px-3 py-1 font-semibold text-(--landing-accent-text)">Revisión interna</span>
            </div>
            <p className="mt-3 text-xl font-semibold">Carrusel de temporada</p>
            <dl className="mt-4 grid gap-2 sm:grid-cols-2">
              {[["Qué sigue", "Aprobación del cliente"], ["Quién la tiene", "Ana López"]].map(([label, value]) => (
                <div key={label} className="rounded-xl bg-(--landing-row) p-3 text-sm">
                  <dt className="text-xs text-(--text-muted)">{label}</dt><dd className="mt-1 font-semibold">{value}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-3 text-sm text-(--text-secondary)">Sale el miércoles 12 a las 10:00</p>
          </div>
          <p className="mt-4 text-sm text-(--text-secondary)">Así se verá cada pieza · <strong>Próximamente</strong></p>
        </article>
        </Reveal>
      </div>
    </section>
  );
}

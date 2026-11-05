import { Hubi } from "../components/brand/Hubi";

const TODOS = [
  ["Mandar minuta a Café Aurora", "Alta", "Ayer"],
  ["Revisar copys de noviembre", "Alta", "Hoy"],
  ["Pedir fotos de producto al estudio", "Media", "Hoy"],
  ["Proponer la parrilla de diciembre", "Media", "Hoy"],
] as const;

export function AppPreview() {
  return (
    <figure className="relative mx-auto mt-18 max-w-(--landing-preview-width) lg:mt-24" data-landing-section="vista-hoy">
      <div className="pointer-events-none absolute -top-17 right-2 z-1 lg:-top-27 lg:right-5">
        <Hubi acabado="volumen" pose="laptop" tamano={216} decorativo prioridad="alta" className="size-27 lg:size-44" sizing="css" />
      </div>
      <div aria-hidden="true" className="glass-panel rounded-(--landing-window-radius)! p-2 shadow-(--landing-shadow)! lg:p-4">
        <div className="grid gap-3 rounded-(--landing-panel-radius) bg-(--landing-soft) p-3.5 text-left lg:grid-cols-[1.45fr_1fr] lg:gap-4 lg:p-5">
          <div className="min-w-0 rounded-3xl bg-(--landing-card) p-3.5 lg:p-5">
            <div className="flex flex-wrap items-center gap-2">
              <strong className="mr-auto text-lg">Hoy</strong>
              <span className="rounded-full bg-(--status-danger-bg) px-2.5 py-1 text-xs font-semibold text-(--status-danger-text)">1 vencido</span>
              <span className="rounded-full bg-(--landing-ice) px-2.5 py-1 text-xs font-semibold text-(--landing-accent-text)">3 para hoy</span>
            </div>
            <ul className="mt-3 grid gap-1.5">
              {TODOS.map(([title, priority, date]) => (
                <li key={title} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-2 rounded-xl bg-(--landing-row) p-2 text-xs sm:grid-cols-[auto_minmax(0,1fr)_auto_auto] lg:p-3 lg:text-sm">
                  <span className="size-3 rounded-sm border border-(--border-control)" />
                  <span className="font-medium">{title}</span>
                  <span className="col-start-2 row-start-2 text-(--text-muted) sm:col-start-auto sm:row-start-auto">{priority}</span>
                  <span className={date === "Ayer" ? "text-(--status-danger-text)" : "text-(--text-muted)"}>{date}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="grid content-start gap-3 rounded-3xl bg-(--landing-card) p-3.5 lg:p-5">
            <span className="text-xs font-semibold text-(--landing-accent-text)">Nota</span>
            <strong className="text-lg">Junta con Café Aurora</strong>
            <p className="text-sm text-(--text-secondary)">Revisar las fotos del local para el carrusel de temporada.</p>
            <span className="w-fit rounded-full bg-(--landing-ice) px-3 py-2 text-xs font-semibold text-(--landing-accent-text)">+ Crear pendiente de esta nota</span>
          </div>
        </div>
      </div>
      <figcaption className="mt-3 text-xs text-(--text-muted)">Ejemplo ilustrativo. Los nombres son inventados.</figcaption>
    </figure>
  );
}

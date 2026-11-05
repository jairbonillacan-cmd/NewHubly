import { Icon } from "../espacio/icons";

const CARD = "rounded-3xl bg-(--landing-card) p-4 shadow-(--landing-shadow) sm:p-5";
const ROW = "flex flex-wrap items-center gap-2 rounded-xl bg-(--landing-row) px-3 py-2";
const ACCENT = "rounded-full bg-(--landing-ice) px-2.5 py-1 font-semibold text-(--landing-accent-text)";
const DANGER = "rounded-full bg-(--status-danger-bg) px-2.5 py-1 font-semibold text-(--status-danger-text)";
const SUCCESS = "rounded-full bg-(--status-success-bg) px-2.5 py-1 font-semibold text-(--status-success-text)";
const TOAST = "w-fit rounded-xl bg-(--landing-ink) px-3 py-2 font-medium text-(--landing-on-ink)";

const TODAY_ROWS = [
  { group: "Vencido", title: "Mandar minuta a Café Aurora", done: false, note: false },
  { group: "Hoy", title: "Revisar copys de noviembre", done: false, note: true },
  { group: "Hoy", title: "Pedir fotos al estudio", done: true, note: false },
  { group: "Mañana", title: "Llamar a Lumen", done: false, note: false },
] as const;

export function TodayVisual() {
  return (
    <div className="relative mx-auto grid w-full max-w-md gap-2 text-xs lg:pb-5">
      <div className={CARD}>
        <p className="mb-2 text-base font-semibold">Hoy</p>
        <ul className="grid gap-1.5">
          {TODAY_ROWS.map(({ group, title, done, note }) => (
            <li key={title} className={ROW}>
              <span className={group === "Vencido" ? "w-14 font-semibold text-(--status-danger-text)" : "w-14 font-semibold text-(--text-muted)"}>{group}</span>
              {done ? <Icon name="check" /> : <span className="size-3 shrink-0 rounded-sm border border-(--border-control)" />}
              <span className={done ? "text-(--text-muted) line-through" : "font-medium"}>{title}</span>
              {note && <span className={ACCENT}>Nota</span>}
            </li>
          ))}
        </ul>
      </div>
      <p className={`${TOAST} justify-self-end lg:absolute lg:right-2 lg:bottom-0`}>Marcado como hecho · <span className="underline">Deshacer</span></p>
    </div>
  );
}

export function CaptureVisual() {
  return (
    <div className="mx-auto grid w-full max-w-md gap-2 text-xs">
      <div className={`${CARD} grid gap-2`}>
        <p className="text-base font-semibold">Llamar a Lumen</p>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className={ACCENT}>mañana</span><span className={DANGER}>!alta</span><span className={SUCCESS}>@aurora</span>
          <span className="ml-auto font-semibold text-(--landing-accent-text)">Agregar</span>
        </div>
      </div>
      <span className="text-center text-xl text-(--landing-accent-text)">↓</span>
      <div className={`${CARD} grid gap-2`}>
        <p className="text-base font-semibold">Llamar a Lumen</p>
        <p className="flex flex-wrap items-center gap-1.5"><span className={DANGER}>Alta</span><span className={ACCENT}>Mañana</span></p>
        <p className="text-(--text-secondary)">Nota: Junta con Café Aurora</p>
      </div>
      <p className={`${TOAST} justify-self-end`}>Agregado a Próximos (mañana) · <span className="underline">Deshacer</span></p>
    </div>
  );
}

export function TeamVisual() {
  return (
    <div className="relative mx-auto grid w-full max-w-sm gap-2 text-xs lg:pt-9 lg:pb-17">
      <p className={`${CARD} w-fit justify-self-end font-semibold lg:absolute lg:top-0 lg:right-0`}>
        <span className={ACCENT}>Privado</span><span className="pl-2">Con la agencia</span>
      </p>
      <div className={CARD}>
        <p className="mb-2 flex flex-wrap items-center justify-between gap-1 text-sm font-semibold">Equipo · Estudio Lumen <span className="text-xs text-(--landing-accent-text)">+ Invitar</span></p>
        <ul className="grid gap-1.5">
          {[["AL", "Ana López", "Administra"], ["MR", "Mario Ruiz", "Edita"], ["SG", "Sofía García", "Solo ve"]].map(([initials, name, role]) => (
            <li key={name} className={ROW}>
              <span className="grid size-6 place-items-center rounded-full bg-(--landing-mist) font-semibold text-(--landing-accent-text)">{initials}</span>
              <span className="mr-auto font-medium">{name}</span><span className="text-(--text-secondary)">{role}</span>
            </li>
          ))}
        </ul>
      </div>
      <div className={`${CARD} w-fit lg:absolute lg:bottom-0 lg:-left-3`}>
        <p className="font-semibold">Invitación enviada</p>
        <p className="mt-1 wrap-anywhere text-(--text-secondary)">equipo@agencia.es · Rol: Edita · Caduca en 7 días</p>
      </div>
    </div>
  );
}

export function ApprovalVisual() {
  return (
    <div className="relative mx-auto grid w-full max-w-md justify-items-center gap-2 text-xs lg:py-5">
      <div className={`${CARD} w-fit max-w-56 justify-self-start lg:absolute lg:top-0 lg:left-0`}>
        <p className="font-semibold">Cliente · foto 2</p>
        <p className="mt-1 text-(--text-secondary)">¿Podemos usar la del local en vez de esta?</p>
      </div>
      <div className="w-51 rounded-(--landing-panel-radius) bg-(--landing-phone) p-2">
        <div className="grid gap-3 rounded-3xl bg-(--landing-card) p-3">
          <div className="grid h-24 grid-cols-3 gap-1 rounded-xl bg-(--landing-mist) p-2 text-(--landing-accent-text)">
            {[1, 2, 3].map((slide) => <span key={slide} className="grid place-items-center rounded-lg bg-(--landing-card)"><Icon name="imagen" /></span>)}
          </div>
          <div>
            <p className="text-sm font-semibold">Carrusel de temporada</p>
            <p className="mt-1 text-(--text-secondary)">Sale el miércoles 12 · Instagram</p>
          </div>
          <div className="flex gap-1"><span className={SUCCESS}>Aprobar</span><span className={ACCENT}>Cambios</span></div>
        </div>
      </div>
      <p className={`${SUCCESS} justify-self-end shadow-(--landing-shadow) lg:absolute lg:right-0 lg:bottom-0`}>✓ Aprobado por el cliente</p>
    </div>
  );
}

import type { ReactNode } from "react";
import { ApprovalVisual, CaptureVisual, TeamVisual, TodayVisual } from "./FeatureVisuals";
import { SectionIntro } from "./SectionIntro";
import { StatusBadge, type FeatureStatus } from "./StatusBadge";

export type { FeatureStatus } from "./StatusBadge";

export interface Feature {
  id: string;
  title: string;
  body: string;
  status: FeatureStatus;
  tint: string;
  visual: ReactNode;
  details: ReactNode;
}

const TODAY_POINTS = [
  ["Lo vencido, arriba", "En rojo, para que no se escape."],
  ["Notas ligadas", "Cada pendiente sabe de qué junta salió."],
  ["Tu zona horaria", "Tu «hoy» empieza a tu medianoche."],
  ["Autoguardado", "Escribes y ya quedó."],
] as const;

const ROLES = [
  ["Propietario", "Todo, incluida la agencia y quién entra."],
  ["Administra", "Invita y gestiona a quienes editan o solo ven."],
  ["Edita", "Crea y edita lo compartido con la agencia."],
  ["Solo ve", "Consulta lo compartido, sin cambiar nada."],
] as const;

export const LANDING_FEATURES: readonly Feature[] = [
  {
    id: "hoy", title: "Tu día, en una lista.", status: "disponible", tint: "bg-(--landing-mist)", visual: <TodayVisual />,
    body: "Abres y ves lo vencido, lo de hoy y lo de mañana. Lo demás puede esperar en Próximos, Sin fecha y Hechos.",
    details: <>
      <dl className="grid grid-cols-2 gap-2">
        {TODAY_POINTS.map(([title, body]) => (
          <div key={title} className="rounded-2xl border border-(--border-default) bg-(--landing-card) p-3 text-sm">
            <dt className="font-semibold">{title}</dt><dd className="mt-1 text-(--text-secondary)">{body}</dd>
          </div>
        ))}
      </dl>
      <a href="/hoy" className="inline-flex min-h-11 items-center justify-center rounded-full bg-(--accent-primary) px-5 text-sm font-semibold text-(--text-on-accent) hover:underline lg:self-start">Probarlo ahora</a>
    </>,
  },
  {
    id: "captura", title: "Escribe como piensas. Hubly entiende.", status: "disponible", tint: "bg-(--landing-paper)", visual: <CaptureVisual />,
    body: "Una sola línea basta. Hubly detecta la fecha, la prioridad y la nota, y lo acomoda donde va.",
    details: <ul className="flex flex-wrap gap-2">
      {["hoy · mañana → fecha", "!alta → prioridad", "@nota → vínculo"].map((chip) => (
        <li key={chip} className="rounded-full bg-(--landing-ice) px-3 py-1.5 text-xs font-semibold text-(--landing-accent-text)">{chip}</li>
      ))}
    </ul>,
  },
  {
    id: "equipo", title: "Cada quien sabe lo suyo.", status: "pronto", tint: "bg-(--landing-ice)", visual: <TeamVisual />,
    body: "Creas tu agencia, invitas a tu equipo con un enlace y eliges qué ve cada persona. Lo privado sigue siendo tuyo.",
    details: <dl className="grid gap-2 text-sm">
      {ROLES.map(([role, body]) => (
        <div key={role} className="rounded-xl bg-(--landing-card) px-3 py-2">
          <dt className="inline font-semibold">{role}: </dt><dd className="inline text-(--text-secondary)">{body}</dd>
        </div>
      ))}
    </dl>,
  },
  {
    id: "aprobacion", title: "El cliente dice sí desde su celular.", status: "proximamente", tint: "bg-(--landing-mist)", visual: <ApprovalVisual />,
    body: "Le mandas un enlace, lo revisa y aprueba o pide cambios. No tiene que crear cuenta ni recordar contraseñas.",
    details: <ul className="list-disc space-y-1 pl-5 text-sm text-(--text-secondary)">
      {["Enlace que caduca", "Comentarios en cada pieza", "Historial de quién aprobó y cuándo"].map((item) => <li key={item}>{item}</li>)}
    </ul>,
  },
];

export function FeatureGrid() {
  return (
    <section id="producto" aria-labelledby="producto-titulo" data-landing-section="producto" className="mx-auto max-w-(--landing-width) scroll-mt-6 px-4 pt-20 lg:pt-28">
      <SectionIntro id="producto-titulo" label="Producto" title="Lo que Hubly hace por tu agencia." body="Te decimos claro qué ya funciona y qué viene en camino." />
      <div className="mt-8 grid gap-12 lg:mt-12 lg:gap-13">
        {LANDING_FEATURES.map((feature, index) => (
          <article key={feature.id} aria-labelledby={`feature-${feature.id}`} data-landing-section={`producto-${feature.id}`} className="grid items-center gap-5 lg:grid-cols-2 lg:gap-12">
            <div aria-hidden="true" data-product-panel="" className={`grid min-w-0 content-center rounded-(--landing-panel-radius) px-4 py-6 lg:min-h-80 lg:px-7 lg:py-10 ${feature.tint} ${index % 2 === 1 ? "lg:order-last" : ""}`}>
              {feature.visual}
            </div>
            <div className="flex min-w-0 flex-col gap-3 lg:px-4">
              <StatusBadge status={feature.status} />
              <h3 id={`feature-${feature.id}`} className="landing-display text-3xl leading-tight font-medium tracking-(--tracking-tight) lg:text-4xl">{feature.title}</h3>
              <p className="leading-relaxed text-(--text-secondary)">{feature.body}</p>
              {feature.details}
            </div>
          </article>
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-(--text-muted)">Ejemplo ilustrativo. Los nombres son inventados.</p>
    </section>
  );
}

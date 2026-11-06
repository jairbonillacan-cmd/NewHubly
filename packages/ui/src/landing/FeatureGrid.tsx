import type { ReactNode } from "react";
import { Hubi, type HubiPose } from "../components/brand/Hubi";
import { ApprovalVisual, CaptureVisual, TeamVisual, TodayVisual } from "./FeatureVisuals";
import { Reveal } from "./Reveal";
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
  /** Hubi que se asoma por la esquina del panel (issue 127). */
  hubi?: Exclude<HubiPose, "sentado" | "laptop">;
}

const TODAY_POINTS = [
  ["Lo vencido, arriba", "En rojo, para que no se escape."],
  ["Cada pendiente con su nota", "Sabes de qué junta salió."],
  ["Tu día, a tu hora", "Aunque trabajes desde otra ciudad."],
  ["Se guarda solo", "Escribes y ya quedó."],
] as const;

const ROLES = [
  ["Propietario", "Todo, incluida la agencia y quién entra."],
  ["Administra", "Invita y gestiona a quienes editan o solo ven."],
  ["Edita", "Crea y edita lo compartido con la agencia."],
  ["Solo ve", "Consulta lo compartido, sin cambiar nada."],
] as const;

export const LANDING_FEATURES: readonly Feature[] = [
  {
    id: "hoy", title: "Organiza ideas y tareas.", status: "disponible", tint: "bg-(--landing-mist)", visual: <TodayVisual />,
    body: "Anotas la idea, sacas de ella los pendientes y abres Hoy para ver qué sigue: lo vencido arriba, lo de hoy y lo de mañana.",
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
    id: "captura", title: "Una línea y ya quedó.", status: "disponible", tint: "bg-(--landing-paper)", visual: <CaptureVisual />, hubi: "ideas",
    body: "Escribes «llamar a Lumen mañana» y queda en tu lista de mañana. Sin llenar formularios.",
    details: <ul className="flex flex-wrap gap-2">
      {["Entiende «hoy» y «mañana»", "Marca lo urgente", "Lo junta con la nota del cliente"].map((chip) => (
        <li key={chip} className="rounded-full bg-(--landing-ice) px-3 py-1.5 text-xs font-semibold text-(--landing-accent-text)">{chip}</li>
      ))}
    </ul>,
  },
  {
    id: "equipo", title: "Trabaja por tu cuenta o con tu equipo.", status: "pronto", tint: "bg-(--landing-ice)", visual: <TeamVisual />, hubi: "comunidad",
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
    id: "aprobacion", title: "Revisa el trabajo con otras personas.", status: "proximamente", tint: "bg-(--landing-mist)", visual: <ApprovalVisual />, hubi: "correo",
    body: "Tu equipo comenta cada pieza y tu cliente la aprueba desde su celular con un enlace, sin crear cuenta.",
    details: <ul className="list-disc space-y-1 pl-5 text-sm text-(--text-secondary)">
      {["Un enlace solo para esa revisión", "Comentarios en cada pieza", "Sabes quién aprobó y cuándo"].map((item) => <li key={item}>{item}</li>)}
    </ul>,
  },
];

export function FeatureGrid() {
  return (
    <section id="producto" aria-labelledby="producto-titulo" data-landing-section="producto" className="mx-auto max-w-(--landing-width) scroll-mt-6 px-4 pt-20 lg:pt-28">
      <Reveal>
        <SectionIntro id="producto-titulo" label="Producto" title="Tu trabajo, conectado." body="Agrupado por lo que haces cada día. Cada cosa lleva su etiqueta: ya disponible, muy pronto o próximamente." />
      </Reveal>
      <div className="mt-8 grid gap-12 lg:mt-12 lg:gap-13">
        {LANDING_FEATURES.map((feature, index) => (
          <Reveal key={feature.id}>
          <article aria-labelledby={`feature-${feature.id}`} data-landing-section={`producto-${feature.id}`} className="grid items-center gap-5 lg:grid-cols-2 lg:gap-12">
            <div aria-hidden="true" data-product-panel="" className={`relative grid min-w-0 content-center rounded-(--landing-panel-radius) px-4 py-6 lg:min-h-80 lg:px-7 lg:py-10 ${feature.tint} ${index % 2 === 1 ? "lg:order-last" : ""}`}>
              {feature.hubi && (
                <div className={`hubly-peek absolute -top-12 ${index % 2 === 1 ? "left-4 lg:left-7" : "right-4 lg:right-7"}`}>
                  <Hubi pose={feature.hubi} tamano={96} decorativo priority="deferred" className="hubly-wiggle size-20 lg:size-24" sizing="css" />
                </div>
              )}
              {feature.visual}
            </div>
            <div className="flex min-w-0 flex-col gap-3 lg:px-4">
              <StatusBadge status={feature.status} />
              <h3 id={`feature-${feature.id}`} className="landing-display text-3xl leading-tight font-medium tracking-(--tracking-tight) lg:text-4xl">{feature.title}</h3>
              <p className="leading-relaxed text-(--text-secondary)">{feature.body}</p>
              {feature.details}
            </div>
          </article>
          </Reveal>
        ))}
      </div>
      <p className="mt-4 text-center text-xs text-(--text-muted)">Ejemplo ilustrativo. Los nombres son inventados.</p>
    </section>
  );
}

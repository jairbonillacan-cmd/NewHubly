import { Chip } from "@heroui/react";
import type { ReactNode } from "react";
import { ApprovalVisual, CalendarVisual, PublishVisual, ReportVisual, TeamVisual, TodayVisual } from "./FeatureVisuals";
import { Reveal } from "./Reveal";

export type FeatureStatus = "disponible" | "pronto" | "proximamente";

const STATUS_LABEL: Record<FeatureStatus, string> = {
  disponible: "Ya disponible",
  pronto: "Muy pronto",
  proximamente: "Próximamente",
};

const STATUS_CHIP: Record<FeatureStatus, { color: "success" | "accent" | "default"; variant: "soft" | "secondary" }> = {
  disponible: { color: "success", variant: "soft" },
  pronto: { color: "accent", variant: "soft" },
  proximamente: { color: "default", variant: "secondary" },
};

export interface Feature {
  id: string;
  eyebrow: string;
  title: string;
  body: string;
  chips: readonly string[];
  status: FeatureStatus;
  tint: string;
  visual: ReactNode;
}

/** Lo que hace Hubly, con su estado real: solo «Hoy» existe; el resto se marca como pronto o próximamente (Constitución #3). */
export const LANDING_FEATURES: readonly Feature[] = [
  { id: "hoy", eyebrow: "Hoy", title: "Tu día, en una lista.", body: "Abres y ves lo vencido, lo de hoy y lo de mañana. Lo demás puede esperar.", chips: ["Lo vencido arriba", "Notas ligadas", "Exportas tus datos"], status: "disponible", tint: "bg-(--tint-blue)", visual: <TodayVisual /> },
  { id: "equipo", eyebrow: "Equipo", title: "Cada quien sabe lo suyo.", body: "Creas tu agencia, invitas a tu equipo y eliges qué ve cada persona.", chips: ["Invitas a tu equipo", "Un rol por persona", "Tú decides qué se comparte"], status: "pronto", tint: "bg-(--tint-green)", visual: <TeamVisual /> },
  { id: "parrilla", eyebrow: "Parrilla", title: "El mes de cada cliente, de un vistazo.", body: "Acomodas las piezas por día y mueves lo que cambie, sin rehacer el Excel.", chips: ["Por cliente", "Por red", "Arrastras y listo"], status: "proximamente", tint: "bg-(--tint-sand)", visual: <CalendarVisual /> },
  { id: "aprobacion", eyebrow: "Aprobación", title: "El cliente dice sí desde su celular.", body: "Le mandas un enlace, lo revisa y aprueba o pide cambios. No tiene que crear cuenta.", chips: ["Enlace que caduca", "Comentarios por pieza", "Sin contraseña"], status: "proximamente", tint: "bg-(--tint-lilac)", visual: <ApprovalVisual /> },
  { id: "publicacion", eyebrow: "Publicación", title: "Lo programas y sale a su hora.", body: "Si algo falla, te avisa y lo vuelve a intentar sin publicar dos veces.", chips: ["Sale solo", "Aviso si falla", "Nunca doble"], status: "proximamente", tint: "bg-(--tint-blue)", visual: <PublishVisual /> },
  { id: "reportes", eyebrow: "Reportes", title: "El reporte del mes, con datos reales.", body: "Listo para mandarlo al cliente, sin copiar números a mano.", chips: ["Datos de cada red", "Listo para compartir"], status: "proximamente", tint: "bg-(--tint-green)", visual: <ReportVisual /> },
];

/** Tarjetas de producto del landing (#85), dos por fila en escritorio y apiladas en móvil. Cada ilustración se puede tocar. */
export function FeatureGrid() {
  return (
    <section id="producto" aria-labelledby="producto-titulo" className="mx-auto w-full max-w-6xl scroll-mt-28 px-4 pt-24 lg:px-6 lg:pt-32">
      <Reveal className="flex flex-col gap-3 lg:items-center lg:text-center">
        <span className="text-xs font-bold tracking-(--tracking-widest) text-(--accent-primary) uppercase">Producto</span>
        <h2 id="producto-titulo" className="m-0 text-4xl leading-tight font-bold tracking-(--tracking-tighter) text-(--text-primary) lg:text-6xl">
          Lo que Hubly hace por tu agencia.
        </h2>
        <p className="m-0 text-base leading-relaxed text-(--text-secondary) lg:text-lg">Te decimos claro qué ya funciona y qué viene en camino. Toca las tarjetas.</p>
      </Reveal>
      <ul className="m-0 mt-10 grid list-none gap-4 p-0 lg:mt-12 lg:grid-cols-2 lg:gap-5">
        {LANDING_FEATURES.map((feature, index) => (
          <li key={feature.id}>
            <Reveal retraso={index % 2 === 0 ? 0 : 1} className="h-full">
              <article
                aria-labelledby={`feature-${feature.id}`}
                className="flex h-full flex-col gap-3.5 rounded-3xl border border-(--border-default) bg-(--surface-raised) p-2.5 pb-6 transition-[transform,box-shadow] duration-300 hover:-translate-y-1 hover:shadow-(--glass-shadow) lg:p-3.5 lg:pb-8"
              >
                <div className={`relative flex h-56 items-center justify-center overflow-hidden rounded-2xl lg:h-72 ${feature.tint}`}>
                  <Chip color={STATUS_CHIP[feature.status].color} variant={STATUS_CHIP[feature.status].variant} size="sm" className="absolute top-3 right-3 font-semibold">
                    {STATUS_LABEL[feature.status]}
                  </Chip>
                  {feature.visual}
                </div>
                <div className="flex flex-col gap-3 px-2.5 pt-1.5 lg:px-4">
                  <span className="text-xs font-bold tracking-(--tracking-widest) text-(--accent-primary) uppercase">{feature.eyebrow}</span>
                  <h3 id={`feature-${feature.id}`} className="m-0 text-2xl leading-tight font-bold tracking-(--tracking-tight) text-(--text-primary) lg:text-3xl">
                    {feature.title}
                  </h3>
                  <p className="m-0 text-base leading-relaxed text-(--text-secondary)">{feature.body}</p>
                  <ul className="m-0 mt-1 flex list-none flex-wrap gap-2 p-0">
                    {feature.chips.map((chip) => (
                      <li key={chip}>
                        <Chip variant="secondary" size="md">{chip}</Chip>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            </Reveal>
          </li>
        ))}
      </ul>
    </section>
  );
}

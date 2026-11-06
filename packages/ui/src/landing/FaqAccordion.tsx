"use client";

import { useId, useState } from "react";

export const LANDING_FAQ = [
  { q: "¿Para quién es Hubly?", a: "Para quien lleva el marketing de su propia marca, aunque trabaje solo, y para agencias y equipos que manejan varias. Es el mismo Hubly: empiezas con tu espacio y creces cuando lo necesites." },
  { q: "¿Qué puedo usar hoy?", a: "Tu espacio personal: tus pendientes del día, tus notas, la captura en una línea y tu propio fondo. Lo de equipo y clientes llega por partes." },
  { q: "¿Funciona en el celular?", a: "Sí. Hubly funciona en el navegador del celular y de la laptop, sin instalar nada. Lo que guardas en uno lo ves en el otro." },
  { q: "¿Mi cliente tiene que crear cuenta?", a: "No. Cuando llegue la aprobación, le mandas un enlace y listo." },
  { q: "¿Cuándo llega la aprobación del cliente?", a: "Está en camino. No damos fechas hasta que funcione de verdad; cuando esté lista, la verás marcada aquí como disponible." },
  { q: "¿Y si un día me quiero ir?", a: "Descargas todo lo que escribiste, cuando quieras y sin pedir permiso." },
] as const;

export function nextFaqIndex(expanded: number | null, selected: number) {
  return expanded === selected ? null : selected;
}

export function FaqAccordion({ expanded, onToggle }: { expanded: number | null; onToggle: (index: number) => void }) {
  const id = useId();

  return (
    <div className="grid gap-2">
      {LANDING_FAQ.map(({ q, a }, index) => {
        const isOpen = expanded === index;
        const buttonId = `${id}-pregunta-${index}`;
        const panelId = `${id}-respuesta-${index}`;
        return (
          <div key={q} data-expanded={isOpen} className="rounded-2xl border border-(--border-default) bg-(--landing-card) data-[expanded=true]:bg-(--landing-ice)">
            <h3>
              <button type="button" id={buttonId} aria-expanded={isOpen} aria-controls={panelId} onClick={() => onToggle(index)} className="flex min-h-16 w-full cursor-pointer items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left text-lg font-semibold lg:px-5">
                {q}<span aria-hidden="true" className="shrink-0 text-xl font-normal text-(--landing-accent-text)">{isOpen ? "−" : "+"}</span>
              </button>
            </h3>
            <div role="region" id={panelId} aria-labelledby={buttonId} hidden={!isOpen} className="px-4 pb-5 leading-relaxed text-(--text-secondary) lg:px-5">{a}</div>
          </div>
        );
      })}
    </div>
  );
}

export function LandingFaq() {
  const [expanded, setExpanded] = useState<number | null>(0);
  return <FaqAccordion expanded={expanded} onToggle={(index) => setExpanded((current) => nextFaqIndex(current, index))} />;
}

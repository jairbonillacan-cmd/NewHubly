"use client";

import { Button, Checkbox, ToggleButton } from "@heroui/react";
import { useState } from "react";
import { chipClass } from "../heroui-classes";
import { Reveal } from "./Reveal";

// Ilustraciones de las tarjetas de producto (#85), con componentes de HeroUI. Son ejemplos que se pueden tocar; no guardan nada.

const MINI = "rounded-xl border border-(--border-default) bg-(--surface-raised) shadow-(--glass-shadow)";
const HINT = "text-xs text-(--text-muted)";

const TODAY_ITEMS = [
  { label: "Mandar minuta", date: "Ayer", overdue: true },
  { label: "Revisar copys", date: "Hoy", overdue: false },
  { label: "Pedir fotos al estudio", date: "Hoy", overdue: false },
] as const;

export function TodayVisual() {
  const [done, setDone] = useState<boolean[]>([false, true, false]);
  return (
    <div className="flex flex-col items-center gap-2">
      <ul className={`m-0 w-72 list-none p-0 py-2 lg:w-90 ${MINI}`}>
        {TODAY_ITEMS.map((item, index) => (
          <li key={item.label}>
            <Checkbox isSelected={done[index] ?? false} onChange={() => setDone((list) => list.map((value, i) => (i === index ? !value : value)))} className="w-full">
              <Checkbox.Content className="flex w-full cursor-pointer flex-row items-center gap-3 px-4 py-2 text-left text-sm hover:bg-(--surface-subtle)">
                <Checkbox.Control className="size-4 shrink-0 rounded-md">
                  <Checkbox.Indicator />
                </Checkbox.Control>
                <span className={`grow transition-colors ${done[index] ? "text-(--text-muted) line-through" : "text-(--text-primary)"}`}>{item.label}</span>
                <span className={`text-xs ${item.overdue && !done[index] ? "text-(--status-danger-text)" : "text-(--text-muted)"}`}>{item.date}</span>
              </Checkbox.Content>
            </Checkbox>
          </li>
        ))}
      </ul>
      <span className={HINT}>Márcalos</span>
    </div>
  );
}

const ROLES = ["Administra", "Edita", "Solo ve"] as const;
const TEAM = [
  { initials: "AL", name: "Ana López", tone: "bg-(--accent-primary)" },
  { initials: "MR", name: "Mario Ruiz", tone: "bg-(--status-success-text)" },
  { initials: "SG", name: "Sofía García", tone: "bg-(--status-warning-text)" },
] as const;

export function TeamVisual() {
  const [roles, setRoles] = useState([0, 1, 2]);
  const cycle = (index: number) => setRoles((list) => list.map((role, i) => (i === index ? (role + 1) % ROLES.length : role)));
  return (
    <div className="flex flex-col items-center gap-2">
      <ul className={`m-0 w-72 list-none p-0 py-2 lg:w-90 ${MINI}`}>
        {TEAM.map((person, index) => (
          <li key={person.initials} className="flex items-center gap-3 px-4 py-1.5">
            <span aria-hidden="true" className={`flex size-8 items-center justify-center rounded-full text-xs font-bold text-(--surface-raised) ${person.tone}`}>{person.initials}</span>
            <span className="grow text-sm font-medium text-(--text-primary)">{person.name}</span>
            <Button size="sm" variant="tertiary" onPress={() => cycle(index)} aria-label={`Rol de ${person.name}: ${ROLES[roles[index] ?? 0]}. Cambiar rol`}>
              <span key={roles[index]} className="hubly-pop inline-block">{ROLES[roles[index] ?? 0]}</span>
            </Button>
          </li>
        ))}
      </ul>
      <span className={HINT}>Toca un rol para cambiarlo</span>
    </div>
  );
}

const DAYS = ["Lun", "Mar", "Mié", "Jue", "Vie"] as const;

export function CalendarVisual() {
  const [slots, setSlots] = useState([true, false, false, true, false, false, true, false, false, false]);
  const planned = slots.filter(Boolean).length;
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`grid w-76 grid-cols-5 gap-2 p-3 lg:w-105 lg:p-4 ${MINI}`}>
        {DAYS.map((day, column) => (
          <div key={day} className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-(--text-muted)">{day}</span>
            {[0, 1].map((row) => {
              const index = column * 2 + row;
              const on = slots[index] ?? false;
              return (
                <ToggleButton
                  key={row}
                  isSelected={on}
                  onChange={(next) => setSlots((list) => list.map((value, i) => (i === index ? next : value)))}
                  aria-label={`${day}, espacio ${row + 1}: ${on ? "con pieza" : "libre"}`}
                  className="h-10 w-full min-w-0 rounded-lg border-0 bg-(--surface-subtle) p-0 transition-all hover:scale-105 data-[selected]:bg-(--accent-primary) lg:h-13"
                />
              );
            })}
          </div>
        ))}
      </div>
      <span className={HINT} aria-live="polite">{planned} piezas en la semana · toca para acomodar</span>
    </div>
  );
}

type Decision = "pendiente" | "aprobado" | "cambios";

export function ApprovalVisual() {
  const [decision, setDecision] = useState<Decision>("pendiente");
  return (
    <div className="flex flex-col items-center gap-2">
      <div className={`flex w-56 flex-col gap-2.5 rounded-3xl p-3 ${MINI}`}>
        <span aria-hidden="true" className="h-24 rounded-xl bg-(--tint-lilac) lg:h-28" />
        <span className="text-sm font-semibold text-(--text-primary)">Post del 12 de nov.</span>
        {decision === "pendiente" ? (
          <span className="flex gap-1.5">
            <Button size="sm" variant="primary" fullWidth onPress={() => setDecision("aprobado")}>Aprobar</Button>
            <Button size="sm" variant="outline" fullWidth onPress={() => setDecision("cambios")}>Cambios</Button>
          </span>
        ) : (
          <Button size="sm" variant={decision === "aprobado" ? "secondary" : "danger-soft"} fullWidth onPress={() => setDecision("pendiente")} className="hubly-pop">
            {decision === "aprobado" ? "Aprobado ✓ · deshacer" : "Cambios pedidos · deshacer"}
          </Button>
        )}
      </div>
      <span className={HINT} aria-live="polite">{decision === "pendiente" ? "Así lo vería tu cliente" : "Te avisamos al instante"}</span>
    </div>
  );
}

type PostState = "publicado" | "programado" | "reintentando";

const POSTS: { title: string; time: string; state: PostState }[] = [
  { title: "Carrusel de temporada", time: "10:00", state: "publicado" },
  { title: "Reel del lanzamiento", time: "18:30", state: "programado" },
  { title: "Historia de promo", time: "12:15", state: "reintentando" },
];

const POST_DOT: Record<PostState, string> = {
  publicado: "bg-(--status-success-text)",
  programado: "bg-(--accent-primary)",
  reintentando: "bg-(--status-warning-text)",
};

export function PublishVisual() {
  const [states, setStates] = useState(POSTS.map((post) => post.state));
  const publish = (index: number) => setStates((list) => list.map((state, i) => (i === index ? "publicado" : state)));
  return (
    <div className="flex flex-col items-center gap-2">
      <ul className="m-0 flex w-72 list-none flex-col gap-2 p-0 lg:w-90">
        {POSTS.map((post, index) => {
          const state = states[index] ?? post.state;
          return (
            <li key={post.title} className={`flex min-h-12 items-center gap-3 py-1.5 pr-1.5 pl-4 ${MINI}`}>
              <span aria-hidden="true" className={`size-2.5 shrink-0 rounded-full transition-colors ${POST_DOT[state]}`} />
              <span className="grow text-sm text-(--text-primary)">{post.title}</span>
              {state === "publicado" ? (
                <span key={state} className={chipClass("success", "soft", "sm", "hubly-pop")}>Publicado · {post.time}</span>
              ) : (
                <Button size="sm" variant={state === "reintentando" ? "danger-soft" : "ghost"} onPress={() => publish(index)}>
                  {state === "reintentando" ? "Reintentar" : "Publicar ya"}
                </Button>
              )}
            </li>
          );
        })}
      </ul>
      <span className={HINT}>Toca para publicar o reintentar</span>
    </div>
  );
}

const BARS = [
  { height: "h-9", week: "Semana 1" },
  { height: "h-13", week: "Semana 2" },
  { height: "h-11", week: "Semana 3" },
  { height: "h-17", week: "Semana 4" },
  { height: "h-14", week: "Semana 5" },
  { height: "h-20", week: "Semana 6" },
  { height: "h-16", week: "Semana 7" },
  { height: "h-24", week: "Semana 8" },
] as const;

export function ReportVisual() {
  const [active, setActive] = useState(BARS.length - 1);
  return (
    <div className={`flex w-72 flex-col gap-3.5 px-5 py-4 lg:w-90 ${MINI}`}>
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-semibold text-(--text-primary)">Reporte de noviembre</span>
        <span className={chipClass("accent", "soft", "sm")} aria-live="polite">{BARS[active]?.week}</span>
      </span>
      <Reveal efecto="hubly-bars" className="flex h-24 items-end gap-2">
        {BARS.map((bar, index) => (
          <span
            key={bar.week}
            onMouseEnter={() => setActive(index)}
            className={`grow cursor-pointer rounded-t-md rounded-b-sm transition-colors ${bar.height} ${index === active ? "bg-(--accent-primary)" : "bg-(--accent-primary-subtle) hover:bg-(--accent-primary)"}`}
          />
        ))}
      </Reveal>
      <span className={HINT}>Ejemplo ilustrativo · pasa el cursor por las barras</span>
    </div>
  );
}

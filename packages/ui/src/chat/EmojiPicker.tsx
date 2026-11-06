"use client";

import { Button, Input } from "@heroui/react";
import React, { useMemo, useRef, useState } from "react";

export type EmojiCategoryId = "frecuentes" | "gestos" | "emociones" | "trabajo" | "simbolos";
export interface EmojiItem { emoji: string; label: string; keywords: readonly string[] }
export interface EmojiCategory { id: EmojiCategoryId; label: string; items: readonly EmojiItem[] }

export const EMOJI_CATEGORIES: readonly EmojiCategory[] = [
  { id: "frecuentes", label: "Frecuentes", items: [
    { emoji: "👍", label: "Pulgar arriba", keywords: ["ok", "bien", "aprobado", "acuerdo", "si"] },
    { emoji: "❤️", label: "Corazón", keywords: ["amor", "gracias", "encanta", "favorito"] },
    { emoji: "🎉", label: "Celebración", keywords: ["fiesta", "exito", "logro", "felicidades", "bravo"] },
    { emoji: "🔥", label: "Fuego", keywords: ["genial", "increible", "caliente", "urgente"] },
    { emoji: "✅", label: "Listo", keywords: ["hecho", "completado", "correcto", "check", "aprobado"] },
    { emoji: "👀", label: "Ojos", keywords: ["mirando", "revisando", "atento", "ver", "ojo"] },
    { emoji: "🙌", label: "Manos arriba", keywords: ["celebrar", "equipo", "hurra", "genial"] },
    { emoji: "😂", label: "Risa", keywords: ["gracioso", "jaja", "divertido", "reir"] },
  ] },
  { id: "gestos", label: "Gestos", items: [
    { emoji: "👋", label: "Saludo", keywords: ["hola", "adios", "mano", "bienvenida"] },
    { emoji: "👏", label: "Aplauso", keywords: ["bravo", "felicitaciones", "bien", "aplaudir"] },
    { emoji: "🤝", label: "Acuerdo", keywords: ["trato", "equipo", "alianza", "gracias"] },
    { emoji: "🙏", label: "Gracias", keywords: ["por favor", "agradecer", "manos"] },
    { emoji: "💪", label: "Fuerza", keywords: ["animo", "fuerte", "vamos", "lograr"] },
    { emoji: "✌️", label: "Paz", keywords: ["victoria", "dos", "tranquilo"] },
    { emoji: "👌", label: "Perfecto", keywords: ["exacto", "excelente", "listo"] },
    { emoji: "🫡", label: "A la orden", keywords: ["entendido", "enterado", "recibido"] },
  ] },
  { id: "emociones", label: "Emociones", items: [
    { emoji: "😀", label: "Sonrisa", keywords: ["feliz", "alegre", "contento"] },
    { emoji: "😊", label: "Sonrisa cálida", keywords: ["amable", "contento", "gracias"] },
    { emoji: "🤩", label: "Entusiasmo", keywords: ["estrellas", "increible", "emocionado"] },
    { emoji: "🤔", label: "Pensando", keywords: ["duda", "idea", "reflexion", "pregunta"] },
    { emoji: "😅", label: "Alivio", keywords: ["uf", "casi", "nervios", "risa"] },
    { emoji: "😮", label: "Sorpresa", keywords: ["asombro", "guau", "inesperado"] },
    { emoji: "😢", label: "Tristeza", keywords: ["triste", "lastima", "pena"] },
    { emoji: "🥳", label: "Festejo", keywords: ["cumpleanos", "meta", "celebrar"] },
  ] },
  { id: "trabajo", label: "Trabajo", items: [
    { emoji: "🚀", label: "Lanzamiento", keywords: ["cohete", "publicar", "rapido", "entrega"] },
    { emoji: "💡", label: "Idea", keywords: ["foco", "propuesta", "creativo", "solucion"] },
    { emoji: "📌", label: "Fijado", keywords: ["importante", "recordar", "chincheta", "nota"] },
    { emoji: "📅", label: "Calendario", keywords: ["fecha", "entrega", "agenda", "reunion"] },
    { emoji: "📝", label: "Nota", keywords: ["escribir", "borrador", "texto", "apunte"] },
    { emoji: "🎯", label: "Objetivo", keywords: ["meta", "foco", "diana", "prioridad"] },
    { emoji: "💬", label: "Comentario", keywords: ["mensaje", "chat", "hablar", "respuesta"] },
    { emoji: "⏳", label: "En curso", keywords: ["tiempo", "espera", "reloj", "pendiente"] },
  ] },
  { id: "simbolos", label: "Símbolos", items: [
    { emoji: "⭐", label: "Estrella", keywords: ["destacado", "favorito", "calidad", "importante"] },
    { emoji: "💯", label: "Cien puntos", keywords: ["perfecto", "total", "excelente", "cien"] },
    { emoji: "⚡", label: "Rayo", keywords: ["rapido", "energia", "urgente", "inmediato"] },
    { emoji: "🔔", label: "Aviso", keywords: ["campana", "alerta", "recordatorio"] },
    { emoji: "✨", label: "Destellos", keywords: ["nuevo", "limpio", "magia", "pulido"] },
    { emoji: "💎", label: "Valor", keywords: ["joya", "calidad", "impecable"] },
    { emoji: "🏆", label: "Trofeo", keywords: ["ganador", "premio", "exito", "meta"] },
    { emoji: "💜", label: "Corazón violeta", keywords: ["apoyo", "equipo", "carino"] },
  ] },
] as const;

const COLS = 8;
const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();

export function filterEmojis(query: string, category: EmojiCategoryId | "todas" = "todas"): EmojiCategory[] {
  const q = normalize(query);
  const source = category === "todas" ? EMOJI_CATEGORIES : EMOJI_CATEGORIES.filter((cat) => cat.id === category);
  if (!q) return [...source];
  return source
    .map((cat) => ({
      ...cat,
      items: cat.items.filter((item) =>
        normalize(item.label).includes(q) || item.keywords.some((kw) => normalize(kw).includes(q)) || item.emoji.includes(q)),
    }))
    .filter((cat) => cat.items.length > 0);
}

export interface EmojiPickerProps {
  onSelect: (emoji: string) => void;
  onClose?: () => void;
  initialQuery?: string;
  initialCategory?: EmojiCategoryId | "todas";
  className?: string;
}

export function EmojiPicker({ onSelect, onClose, initialQuery = "", initialCategory = "todas", className = "" }: EmojiPickerProps) {
  const [query, setQuery] = useState(initialQuery);
  const [category, setCategory] = useState<EmojiCategoryId | "todas">(initialCategory);
  const [activeIndex, setActiveIndex] = useState(0);
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const groups = useMemo(() => filterEmojis(query, category), [query, category]);
  const flatItems = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const safeActive = flatItems.length ? Math.min(activeIndex, flatItems.length - 1) : 0;

  function moveFocus(nextIndex: number) {
    if (!flatItems.length) return;
    const bounded = Math.max(0, Math.min(flatItems.length - 1, nextIndex));
    setActiveIndex(bounded);
    buttonRefs.current[bounded]?.focus();
  }

  function handleGridKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") { event.preventDefault(); onClose?.(); return; }
    if (!flatItems.length) return;
    const offsets: Record<string, number> = {
      ArrowRight: 1, ArrowLeft: -1, ArrowDown: COLS, ArrowUp: -COLS,
      Home: -safeActive, End: flatItems.length - 1 - safeActive,
    };
    const step = offsets[event.key];
    if (step !== undefined) { event.preventDefault(); moveFocus(safeActive + step); }
  }

  let cursor = 0;
  return (
    <div role="region" aria-label="Selector de emojis"
      onKeyDown={(event) => { if (event.key === "Escape") { event.stopPropagation(); onClose?.(); } }}
      className={`hubly-pop-surface hubly-chat-msg-enter flex w-72 flex-col gap-2 rounded-2xl p-3 text-(--text-primary) ${className}`}>
      <Input type="search" aria-label="Buscar emoji" placeholder="Buscar emoji…" value={query}
        onChange={(event) => { setQuery(event.target.value); setActiveIndex(0); }}
        onKeyDown={(event) => { if (event.key === "ArrowDown" && flatItems.length) { event.preventDefault(); moveFocus(0); } }}
        className="w-full text-sm" />
      <div role="group" aria-label="Categorías de emojis" className="flex flex-wrap gap-1 border-b border-(--border-subtle) pb-2">
        <Button size="sm" variant={category === "todas" ? "secondary" : "ghost"} aria-pressed={category === "todas"}
          onPress={() => { setCategory("todas"); setActiveIndex(0); }} className="min-h-8 px-2 text-xs">Todas</Button>
        {EMOJI_CATEGORIES.map((cat) => (
          <Button key={cat.id} size="sm" variant={category === cat.id ? "secondary" : "ghost"} aria-pressed={category === cat.id}
            onPress={() => { setCategory(cat.id); setActiveIndex(0); }} className="min-h-8 px-2 text-xs">{cat.label}</Button>
        ))}
      </div>
      <div role="grid" aria-label="Lista de emojis" onKeyDown={handleGridKeyDown} className="max-h-56 space-y-2 overflow-y-auto pr-1">
        {groups.length ? groups.map((group) => (
          <section key={group.id} aria-label={group.label}>
            <h3 className="mb-1 text-xs font-semibold text-(--text-secondary)">{group.label}</h3>
            <div role="row" className="grid grid-cols-8 gap-1">
              {group.items.map((item) => {
                const idx = cursor++;
                return (
                  <button key={`${group.id}-${item.emoji}`} ref={(el) => { buttonRefs.current[idx] = el; }}
                    type="button" role="gridcell" tabIndex={idx === safeActive ? 0 : -1} aria-label={item.label} title={item.label}
                    onFocus={() => setActiveIndex(idx)} onClick={() => onSelect(item.emoji)}
                    className="flex size-8 cursor-pointer items-center justify-center rounded-lg border-0 bg-transparent text-lg hover:bg-(--surface-interactive) focus-visible:outline-2 focus-visible:outline-(--focus-ring-color)">
                    <span aria-hidden="true">{item.emoji}</span>
                  </button>
                );
              })}
            </div>
          </section>
        )) : <p role="status" className="py-4 text-center text-xs text-(--text-secondary)">No hay emojis que coincidan con tu búsqueda.</p>}
      </div>
    </div>
  );
}

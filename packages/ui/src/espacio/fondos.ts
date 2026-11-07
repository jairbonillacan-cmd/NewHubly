/** Datos de los fondos ilustrados, sin "use client": los usan también componentes de servidor (Wallpaper en /login). */
/* Fondos ilustrados servidos desde /fondos/ (apps/web/public). Los marcados como animados traen además «-animado.webp». */
export const FONDOS_ILUSTRADOS = [
  { id: "aurora-polar", nombre: "Aurora polar", animado: true },
  { id: "bosque-de-niebla", nombre: "Bosque de niebla", animado: true },
  { id: "dunas-de-cobre", nombre: "Dunas de cobre", animado: true },
  { id: "jardin-japones", nombre: "Jardín japonés", animado: true },
  { id: "lluvia-en-casa", nombre: "Lluvia en casa", animado: true },
  { id: "marea-lenta", nombre: "Marea lenta", animado: true },
  { id: "herbario-de-tinta", nombre: "Herbario de tinta", animado: false },
  { id: "jardin-submarino", nombre: "Jardín submarino", animado: false },
  { id: "luz-de-cantera", nombre: "Luz de cantera", animado: false },
  { id: "papel-plegado", nombre: "Papel plegado", animado: false },
  { id: "refugio-alpino", nombre: "Refugio alpino", animado: false },
  { id: "tokio-nocturno", nombre: "Tokio nocturno", animado: false },
] as const;

export type FondoIlustradoId = (typeof FONDOS_ILUSTRADOS)[number]["id"];

export function fondoIlustrado(id: string) {
  return FONDOS_ILUSTRADOS.find((fondo) => fondo.id === id);
}


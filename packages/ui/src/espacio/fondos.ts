/** Datos de los fondos ilustrados, sin "use client": los usan también componentes de servidor (Wallpaper en /login). */
/* Fondos ilustrados servidos desde /fondos/ (apps/web/public). Todos traen además «-animado.webp»: los seis últimos se generan desde la imagen estática con un movimiento lento de cámara en bucle. */
export const FONDOS_ILUSTRADOS = [
  { id: "aurora-polar", nombre: "Aurora polar", animado: true },
  { id: "bosque-de-niebla", nombre: "Bosque de niebla", animado: true },
  { id: "dunas-de-cobre", nombre: "Dunas de cobre", animado: true },
  { id: "jardin-japones", nombre: "Jardín japonés", animado: true },
  { id: "lluvia-en-casa", nombre: "Lluvia en casa", animado: true },
  { id: "marea-lenta", nombre: "Marea lenta", animado: true },
  { id: "herbario-de-tinta", nombre: "Herbario de tinta", animado: true },
  { id: "jardin-submarino", nombre: "Jardín submarino", animado: true },
  { id: "luz-de-cantera", nombre: "Luz de cantera", animado: true },
  { id: "papel-plegado", nombre: "Papel plegado", animado: true },
  { id: "refugio-alpino", nombre: "Refugio alpino", animado: true },
  { id: "tokio-nocturno", nombre: "Tokio nocturno", animado: true },
] as const;

export type FondoIlustradoId = (typeof FONDOS_ILUSTRADOS)[number]["id"];

export function fondoIlustrado(id: string) {
  return FONDOS_ILUSTRADOS.find((fondo) => fondo.id === id);
}


import { type CalendarDate, endOfMonth, endOfWeek, getDayOfWeek, isSameDay, isSameMonth, parseDate, startOfMonth, startOfWeek } from "@internationalized/date";

export type CalendarioColorMarca = "azul" | "arena" | "verde" | "lila";
export type CalendarioCanal = "instagram" | "facebook" | "tiktok" | "linkedin" | "x" | "youtube" | "blog" | "email" | "otro";
export type CalendarioEstadoPieza = "idea" | "borrador" | "revision" | "aprobacion_cliente" | "programada" | "aprobada" | "publicada" | "medida";
export type CalendarioVista = "mes" | "semana" | "lista";

export interface CalendarioPiezaItem {
  id: string; titulo: string; marcaId: string; marcaNombre: string; marcaColor: CalendarioColorMarca;
  canal: CalendarioCanal; estado: CalendarioEstadoPieza; fecha: string; hora?: string | null | undefined;
  campana?: string | null | undefined; responsableNombre?: string | null | undefined; visibilidad?: "private" | "workspace" | undefined;
}
export interface CalendarioMonthCell { date: string; dayNumber: number; inCurrentMonth: boolean; isToday: boolean }
export interface CalendarioWeekDay { date: string; dayNumber: number; weekdayLabel: string; isToday: boolean }

export const CALENDARIO_LOCALE = "es-MX";
export const CALENDARIO_WEEKDAYS_SHORT = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;
export const MARCA_COLOR_TOKEN: Record<CalendarioColorMarca, string> = { azul: "var(--tint-blue)", arena: "var(--tint-sand)", verde: "var(--tint-green)", lila: "var(--tint-lilac)" };
export const MARCA_COLOR_BG: Record<CalendarioColorMarca, string> = { azul: "bg-(--tint-blue)", arena: "bg-(--tint-sand)", verde: "bg-(--tint-green)", lila: "bg-(--tint-lilac)" };

export const CANAL_INFO: Record<CalendarioCanal, { abbr: string; label: string }> = {
  instagram: { abbr: "IG", label: "Instagram" }, facebook: { abbr: "FB", label: "Facebook" }, tiktok: { abbr: "TT", label: "TikTok" },
  linkedin: { abbr: "IN", label: "LinkedIn" }, x: { abbr: "X", label: "X" }, youtube: { abbr: "YT", label: "YouTube" },
  blog: { abbr: "Blog", label: "Blog" }, email: { abbr: "Email", label: "Email" }, otro: { abbr: "Otro", label: "Otro" },
};

export const ESTADO_PIEZA_LABEL: Record<CalendarioEstadoPieza, string> = {
  idea: "Idea", borrador: "Borrador", revision: "En revisión", aprobacion_cliente: "Aprobación cliente",
  programada: "Programada", aprobada: "Aprobada", publicada: "Publicada", medida: "Medida",
};

/** Construye la cuadrícula mensual con semana iniciando en lunes (es-MX) sobre @internationalized/date. */
export function buildMonthGrid(anchorIsoDate: string, todayIsoDate: string = anchorIsoDate): CalendarioMonthCell[][] {
  const anchor: CalendarDate = parseDate(anchorIsoDate), todayDate: CalendarDate = parseDate(todayIsoDate);
  const gridStart = startOfWeek(startOfMonth(anchor), CALENDARIO_LOCALE, "mon"), gridEnd = endOfWeek(endOfMonth(anchor), CALENDARIO_LOCALE, "mon");
  const weeks: CalendarioMonthCell[][] = [];
  for (let cursor = gridStart; cursor.compare(gridEnd) <= 0; ) {
    const week: CalendarioMonthCell[] = [];
    for (let i = 0; i < 7; i++, cursor = cursor.add({ days: 1 })) {
      if (getDayOfWeek(cursor, CALENDARIO_LOCALE, "mon") === i) {
        week.push({ date: cursor.toString(), dayNumber: cursor.day, inCurrentMonth: isSameMonth(cursor, anchor), isToday: isSameDay(cursor, todayDate) });
      }
    }
    weeks.push(week);
  }
  return weeks;
}

/** Construye los 7 días de la semana (lunes a domingo en es-MX) a partir de una fecha ancla. */
export function buildWeekDays(anchorIsoDate: string, todayIsoDate: string = anchorIsoDate): CalendarioWeekDay[] {
  const anchor = parseDate(anchorIsoDate), todayDate = parseDate(todayIsoDate), weekStart = startOfWeek(anchor, CALENDARIO_LOCALE, "mon");
  return CALENDARIO_WEEKDAYS_SHORT.map((weekdayLabel, index) => {
    const current = weekStart.add({ days: index });
    return { date: current.toString(), dayNumber: current.day, weekdayLabel, isToday: isSameDay(current, todayDate) };
  });
}

export function sortPiezasByHora(items: readonly CalendarioPiezaItem[]): CalendarioPiezaItem[] {
  return [...items].sort((a, b) => {
    const horaA = a.hora?.slice(0, 5) ?? "99:99", horaB = b.hora?.slice(0, 5) ?? "99:99";
    return horaA !== horaB ? horaA.localeCompare(horaB) : a.titulo.localeCompare(b.titulo, CALENDARIO_LOCALE);
  });
}

export function formatCalendarioDateLong(isoDate: string): string {
  const formatted = new Intl.DateTimeFormat(CALENDARIO_LOCALE, { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" }).format(new Date(`${isoDate}T00:00:00Z`));
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

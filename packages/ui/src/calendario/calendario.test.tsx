import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { Calendar, CalendarioLista, CalendarioMes, CalendarioSemana, DateField, DatePicker, PiezaChip, buildMonthGrid, buildWeekDays, type CalendarioPiezaItem } from "../index";

const TODAY = "2026-11-06";

const PIEZAS: CalendarioPiezaItem[] = [
  { id: "p1", titulo: "Reel de proceso", marcaId: "m1", marcaNombre: "Café Aurora", marcaColor: "arena", canal: "instagram", estado: "publicada", fecha: TODAY, hora: "09:00" },
  { id: "p2", titulo: "Hilo técnico", marcaId: "m2", marcaNombre: "Lumen", marcaColor: "azul", canal: "x", estado: "aprobada", fecha: TODAY, hora: "11:00" },
  { id: "p3", titulo: "Post de cultura", marcaId: "m3", marcaNombre: "Pulso", marcaColor: "verde", canal: "linkedin", estado: "revision", fecha: TODAY, hora: "13:00" },
  { id: "p4", titulo: "Boletín mensual", marcaId: "m4", marcaNombre: "Nube", marcaColor: "lila", canal: "email", estado: "borrador", fecha: TODAY, hora: "16:00" },
  { id: "p5", titulo: "Guía de cierre", marcaId: "m1", marcaNombre: "Café Aurora", marcaColor: "arena", canal: "blog", estado: "idea", fecha: TODAY, hora: "18:00" },
];

describe("Calendario editorial en @hubly/ui (ADR 0011, issue 195)", () => {
  it("reexporta DatePicker, DateField y Calendar de HeroUI v3 OSS desde @hubly/ui", () => {
    expect(typeof DatePicker).toBe("function");
    expect(typeof DateField).toBe("function");
    expect(typeof Calendar).toBe("function");
  });

  it("construye mes y semana en es-MX iniciando siempre en lunes (Lun a Dom)", () => {
    const days = buildWeekDays("2026-11-06", TODAY);
    expect(days.map((d) => d.weekdayLabel)).toEqual(["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]);
    expect(days[0]?.date).toBe("2026-11-02");
    expect(days[6]?.date).toBe("2026-11-08");
    expect(days.find((d) => d.isToday)?.date).toBe(TODAY);

    const weeks = buildMonthGrid("2026-11-06", TODAY);
    expect(weeks.length).toBeGreaterThanOrEqual(5);
    expect(weeks[0]?.[0]?.date).toBe("2026-10-26");
    expect(weeks[0]?.[0]?.inCurrentMonth).toBe(false);
    expect(weeks[0]?.[6]?.date).toBe("2026-11-01");
    expect(weeks[0]?.[6]?.inCurrentMonth).toBe(true);
  });

  it("CalendarioMes renderiza cabeceras Lun..Dom, muestra «+N más» con más de 3 piezas y permite expandir", () => {
    const html = renderToStaticMarkup(createElement(CalendarioMes, { anchorDate: TODAY, todayDate: TODAY, piezas: PIEZAS, onCreateOnDate: vi.fn(), onDropPieceOnDate: vi.fn() }));
    expect(html).toContain('aria-label="Calendario mensual"');
    const headers = Array.from(html.matchAll(/role="columnheader"[^>]*>([^<]+)<\/div>/g), (m) => m[1]);
    expect(headers).toEqual(["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"]);
    expect(html).toContain("+2 más");
    expect(html).toContain("Reel de proceso");
    expect(html).not.toContain("Guía de cierre");

    const expandedHtml = renderToStaticMarkup(createElement(CalendarioMes, { anchorDate: TODAY, todayDate: TODAY, piezas: PIEZAS, defaultExpandedDates: [TODAY] }));
    expect(expandedHtml).toContain("Guía de cierre");
    expect(expandedHtml).not.toContain("+2 más");
  });

  it("CalendarioSemana, CalendarioLista y PiezaChip renderizan colores semánticos, canales, estados y disparan callbacks", () => {
    const semanaHtml = renderToStaticMarkup(createElement(CalendarioSemana, { anchorDate: TODAY, todayDate: TODAY, piezas: PIEZAS.slice(0, 2), onCreateOnDate: vi.fn() }));
    expect(semanaHtml).toContain('aria-label="Calendario semanal"');
    expect(semanaHtml).toContain("Sin entregas");
    expect(semanaHtml).toContain('aria-label="Crear pieza el 2026-11-06"');

    const listaHtml = renderToStaticMarkup(createElement(CalendarioLista, { todayDate: TODAY, piezas: PIEZAS.slice(0, 2) }));
    expect(listaHtml).toContain('aria-label="Agenda editorial"');
    expect(listaHtml).toContain("2 piezas");
    expect(listaHtml).toContain(">Hoy<");

    const vaciaHtml = renderToStaticMarkup(createElement(CalendarioLista, { todayDate: TODAY, piezas: [], onCreatePieza: vi.fn() }));
    expect(vaciaHtml).toContain('role="status"');
    expect(vaciaHtml).toContain("Sin piezas en este periodo");
    expect(vaciaHtml).toContain("Nueva pieza");

    const onSelect = vi.fn();
    const chipEl = PiezaChip({ pieza: PIEZAS[0]!, draggable: true, selected: true, onSelect });
    chipEl.props.onClick();
    expect(onSelect).toHaveBeenCalledWith("p1");
    const chipHtml = renderToStaticMarkup(createElement(PiezaChip, { pieza: PIEZAS[0]!, draggable: true, selected: true }));
    expect(chipHtml).toContain('data-piece-id="p1"');
    expect(chipHtml).toContain('data-brand-color="arena"');
    expect(chipHtml).toContain("var(--tint-sand)");
    expect(chipHtml).toContain('aria-pressed="true"');
    expect(chipHtml).toContain("Publicada");
    expect(chipHtml).toContain(">IG<");
    expect(chipHtml).not.toMatch(/<button[^>]*>\s*<\/button>/);
  });
});

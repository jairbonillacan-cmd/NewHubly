import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EspacioHoy, type EspacioHoyProps } from "../index";

const noop = () => {};
const base: EspacioHoyProps = {
  todayDate: "2026-11-05", todos: [], notes: [], noteSaveStates: {}, analyzeCapture: (text: string) => ({ title: text, dueDate: null, dueKeyword: null, priority: null, noteQuery: null }),
  onCapture: async () => true, onToggleTodo: noop, onCreateNote: async () => null, onSaveNote: noop, onTogglePin: noop, onToggleArchive: noop, onExport: noop, onSignOut: noop,
};
const render = (props: Partial<EspacioHoyProps> = {}) => renderToStaticMarkup(createElement(EspacioHoy, { ...base, ...props }));

describe("Marco fijo de Tu espacio (issue 105): barra superior, carril y dock fijos; solo el contenido se desliza", () => {
  it("en escritorio es una cuadrícula a pantalla completa y solo el contenido tiene desplazamiento propio", () => {
    const html = render();
    expect(html).toMatch(/class="[^"]*lg:grid lg:h-dvh[^"]*lg:overflow-hidden/);
    expect(html).toMatch(/<main id="contenido" tabindex="-1" class="[^"]*lg:overflow-y-auto/);
    // Nada del marco se posiciona con position: fixed encadenado en escritorio.
    expect(html).not.toMatch(/lg:absolute/);
  });

  it("empieza con un enlace para saltar al contenido", () => {
    const html = render();
    expect(html.indexOf('href="#contenido"')).toBeGreaterThan(-1);
    expect(html.indexOf('href="#contenido"')).toBeLessThan(html.indexOf('role="toolbar"'));
    expect(html).toContain("Saltar al contenido");
  });

  it("la barra superior tiene el grupo de controles en orden y el avatar con la inicial del correo", () => {
    const html = render({ userEmail: "ana@agencia.es" });
    const toolbar = html.slice(html.indexOf('role="toolbar" aria-label="Controles del espacio"'));
    const order = ["Buscar o ejecutar (Ctrl K)", "Enfoque", "Avisos", "Cambiar a tema", "Ayuda y atajos", "Ajustes"].map((label) => toolbar.indexOf(label));
    expect(order.every((index) => index > -1)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html).toContain('aria-label="Menú de tu cuenta"');
    expect(html).toMatch(/>A<\/span>/);
  });

  it("el botón Enfoque refleja el modo enfoque guardado", () => {
    const enfoque = render({ initialPreferences: { fondo: "contornos", opacidad: 78, distribucion: "enfoque", paneles: { hoy: true, nota: true, notas: true } } });
    expect(enfoque).toMatch(/aria-pressed="true"[^>]*>(?:(?!<\/button>).)*Enfoque/);
    expect(render()).toMatch(/aria-pressed="false"[^>]*>(?:(?!<\/button>).)*Enfoque/);
  });
});

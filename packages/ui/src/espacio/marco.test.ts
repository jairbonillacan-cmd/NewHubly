import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { Carril, EspacioHoy, Proximamente, herramientaPorId, resumenSemana, type CarrilProps, type EspacioHoyProps } from "../index";

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
    // Sin repetidos: el tema vive en Apariencia; Enfoque queda al final, a la derecha.
    const order = ["Buscar o ejecutar (Ctrl K)", "Avisos", "Ayuda y atajos", "Vista y aspecto", "Enfoque"].map((label) => toolbar.indexOf(label));
    expect(toolbar).not.toContain("Cambiar a tema");
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

describe("Carril de herramientas", () => {
  const renderRail = (props: Partial<CarrilProps> = {}) => renderToStaticMarkup(createElement(Carril, {
    expandido: false, activa: "hoy", onToggleExpandido: noop, onSelect: noop, hoyPendientes: 3,
    semana: { hechos: 1, total: 3 }, ...props,
  }));

  it("en compacto marca Hoy como página activa y permite expandir el carril", () => {
    const html = renderRail();
    expect(html).toMatch(/<button[^>]*(?=[^>]*aria-label="Hoy")(?=[^>]*aria-current="page")/);
    expect(html).toMatch(/<button[^>]*(?=[^>]*aria-label="Expandir el carril")(?=[^>]*aria-expanded="false")/);
    expect(html).not.toContain("Tu semana");
  });

  it("en completo muestra las fichas, el progreso y la acción de agregar desactivada", () => {
    const html = renderRail({ expandido: true, activa: "calendario" });
    expect(html).toMatch(/<button[^>]*(?=[^>]*aria-label="Calendario, próximamente")(?=[^>]*aria-current="page")/);
    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    expect(html).toMatch(/<button[^>]*(?=[^>]*aria-label="Contraer el carril")(?=[^>]*aria-expanded="true")/);
    expect(html).toMatch(/<button[^>]*(?=[^>]*aria-label="Agregar una herramienta, muy pronto")(?=[^>]* disabled="")/);
    expect(html).toContain(">Pronto<");
    expect(html).toContain(">Tu semana<");
    expect(html).toMatch(/<progress[^>]*value="1"[^>]*max="3"/);
  });

  it("presenta una herramienta futura con su icono, nombre y descripción", () => {
    const tool = herramientaPorId("calendario");
    const html = renderToStaticMarkup(createElement(Proximamente, { herramienta: tool }));
    expect(html).toContain("<svg");
    expect(html).toContain(">Próximamente<");
    expect(html).toContain(">Calendario</h2>");
    expect(html).toContain(tool.descripcion);
  });

  it("abre Calendario desde el estado inicial y muestra Próximamente en lugar de los paneles", () => {
    const content = (html: string) => html.match(/<main\b[^>]*>(?:<div class="hubly-espacio-escena[^>]*>)?(.*?)(?:<\/div>)?<\/main>/s)?.[1];
    expect(content(render())).toContain("Hoy");
    expect(content(render({ initialHerramienta: "calendario" }))).toMatch(/^<section[^>]*aria-labelledby="proximamente-titulo"[\s\S]*>Calendario<\/h2>[\s\S]*<\/section>$/);
  });

  it.each(["2026-11-02", "2026-11-05", "2026-11-08"])("incluye lunes y domingo de la semana de %s", (date) => {
    expect(resumenSemana([
      { dueDate: "2026-11-01", isDone: true },
      { dueDate: "2026-11-02", isDone: true },
      { dueDate: "2026-11-04", isDone: false },
      { dueDate: "2026-11-08", isDone: true },
      { dueDate: "2026-11-09", isDone: true },
      { dueDate: null, isDone: true },
    ], date)).toEqual({ hechos: 2, total: 3 });
  });
});

describe("Marco compacto: medidas por tokens y objetivos táctiles de 44 px", () => {
  const css = readFileSync(new URL("../tokens.css", import.meta.url), "utf8");
  const px = (name: string) => Number(new RegExp(`${name}:\\s*([\\d.]+)rem`).exec(css)![1]) * 16;

  it("define el ancho del carril y la altura de la barra y del dock como tokens, y el marco los usa", () => {
    expect(px("--frame-rail-w")).toBe(56);
    expect(px("--frame-rail-w-open")).toBeLessThan(240);
    expect(px("--frame-topbar-h")).toBeLessThan(56);
    expect(px("--frame-dock-h")).toBeLessThan(64);
    const html = render();
    expect(html).toContain("lg:grid-rows-[var(--frame-topbar-h)_minmax(0,1fr)_auto]");
    expect(html).toContain("h-(--frame-topbar-h)");
    expect(html).toContain("h-(--frame-dock-h)");
  });

  it("el carril retraído deja 44 px útiles por botón (ancho menos el relleno) y el desplegado usa su token", () => {
    expect(px("--frame-rail-w") - 2 * px("--frame-rail-pad")).toBeGreaterThanOrEqual(44);
    const rail = (expandido: boolean) => renderToStaticMarkup(createElement(Carril, { expandido, activa: "hoy", onToggleExpandido: noop, onSelect: noop, hoyPendientes: 0, semana: { hechos: 0, total: 0 } }));
    expect(rail(false)).toContain("w-(--frame-rail-w) ");
    expect(rail(true)).toContain("w-(--frame-rail-w-open)");
    expect(/<button[^>]*aria-label="Hoy"[^>]*>/.exec(rail(false))![0]).toContain(" h-11 ");
  });
});

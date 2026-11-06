import { describe, expect, it } from "vitest";
import { PANEL_MIN, redimensionar, LIENZO_PASO, LIENZO_ZOOM_MAX, LIENZO_ZOOM_MIN, alinear, clampZoom, fitView, visibleRect, zoomAt } from "./Lienzo";

describe("Lienzo infinito (issue 136)", () => {
  it("acerca y aleja sin mover el punto bajo el cursor", () => {
    const view = { x: 40, y: -20, zoom: 1 };
    const next = zoomAt(view, 1.5, 300, 200);
    // El punto del lienzo bajo (300, 200) antes y después es el mismo.
    expect((300 - view.x) / view.zoom).toBeCloseTo((300 - next.x) / next.zoom);
    expect((200 - view.y) / view.zoom).toBeCloseTo((200 - next.y) / next.zoom);
  });

  it("limita el zoom entre el mínimo y el máximo", () => {
    expect(clampZoom(10)).toBe(LIENZO_ZOOM_MAX);
    expect(clampZoom(0.01)).toBe(LIENZO_ZOOM_MIN);
    expect(zoomAt({ x: 0, y: 0, zoom: 1 }, 99, 0, 0).zoom).toBe(LIENZO_ZOOM_MAX);
  });

  it("encuadra todos los paneles centrados y nunca acerca más del 100 %", () => {
    const rects = [{ x: 0, y: 0, w: 600, h: 600 }, { x: 640, y: 0, w: 400, h: 300 }];
    const big = fitView(rects, 4000, 3000);
    expect(big.zoom).toBe(1);
    expect(big.x).toBeCloseTo((4000 - 1040) / 2);
    const small = fitView(rects, 800, 500, 0);
    expect(small.zoom).toBeCloseTo(Math.min(800 / 1040, 500 / 600));
  });

  it("el mapa marca lo que se ve en coordenadas del lienzo (issue 141)", () => {
    expect(visibleRect({ x: -200, y: 100, zoom: 2 }, 800, 600)).toEqual({ x: 100, y: -50, w: 400, h: 300 });
  });

  it("con el imán, los paneles caen en la cuadrícula; sin él, solo se redondean", () => {
    expect(alinear(LIENZO_PASO * 3 + 5, true)).toBe(LIENZO_PASO * 3);
    expect(alinear(37.6, false)).toBe(38);
  });

  it("cambia el tamaño desde cualquier borde sin mover el lado opuesto ni bajar del mínimo (issue 147)", () => {
    const rect = { x: 100, y: 100, w: 400, h: 300 };
    expect(redimensionar(rect, "w", -50, 0)).toEqual({ x: 50, y: 100, w: 450, h: 300 });
    expect(redimensionar(rect, "n", 0, 40)).toEqual({ x: 100, y: 140, w: 400, h: 260 });
    expect(redimensionar(rect, "se", 20, 30)).toEqual({ x: 100, y: 100, w: 420, h: 330 });
    const chico = redimensionar(rect, "nw", 999, 999);
    expect([chico.w, chico.h]).toEqual([PANEL_MIN.w, PANEL_MIN.h]);
    expect(chico.x + chico.w).toBe(rect.x + rect.w);
  });
});

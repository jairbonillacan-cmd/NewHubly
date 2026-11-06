import { describe, expect, it } from "vitest";
import { LIENZO_ZOOM_MAX, LIENZO_ZOOM_MIN, clampZoom, fitView, zoomAt } from "./Lienzo";

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
});

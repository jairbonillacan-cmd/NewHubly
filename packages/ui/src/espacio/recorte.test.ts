import { describe, expect, it } from "vitest";
import { RECORTE_VISOR, escalaBase, limitarEncuadre } from "./FotoRecorte";

describe("Recorte de la foto de perfil (issue 150)", () => {
  it("la foto siempre cubre el círculo, también rotada", () => {
    expect(escalaBase(400, 200, 0)).toBe(RECORTE_VISOR / 200);
    expect(escalaBase(400, 200, 90)).toBe(RECORTE_VISOR / 200);
    expect(escalaBase(100, 512, 0)).toBe(RECORTE_VISOR / 100);
  });

  it("no deja mover la foto tanto que aparezca un hueco", () => {
    const e = limitarEncuadre({ zoom: 1, rotacion: 0, x: 999, y: 999 }, 400, 200);
    // A zoom 1 la foto mide 512 × 256: sobra en horizontal, nada en vertical.
    expect(e.x).toBe((512 - RECORTE_VISOR) / 2);
    expect(e.y).toBe(0);
    expect(limitarEncuadre({ zoom: 2, rotacion: 90, x: 0, y: -999 }, 400, 200).y).toBe(-(400 * (RECORTE_VISOR / 200) * 2 - RECORTE_VISOR) / 2);
  });
});

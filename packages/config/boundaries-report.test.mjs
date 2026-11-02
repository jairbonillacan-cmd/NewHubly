import { describe, expect, it } from "vitest";
import { evaluateCruise } from "./boundaries-report.mjs";

const mod = (source) => ({ source });

describe("evaluateCruise", () => {
  it("acepta un análisis que cubre todos los paquetes sin violaciones", () => {
    const result = { modules: [mod("apps/web/src/app/page.tsx"), mod("packages/db/src/index.ts")], summary: { violations: [] } };
    expect(evaluateCruise(result, ["apps/web", "packages/db"])).toEqual([]);
  });

  it("falla si no se analizó ningún módulo (verde falso)", () => {
    expect(evaluateCruise({ modules: [], summary: { violations: [] } }, ["apps/web"])).toEqual([
      "dependency-cruiser no analizó ningún módulo",
      "sin módulos analizados en apps/web",
    ]);
  });

  it("falla si un paquete quedó sin analizar", () => {
    const result = { modules: [mod("apps/web/src/app/page.tsx")], summary: { violations: [] } };
    expect(evaluateCruise(result, ["apps/web", "packages/domain"])).toEqual(["sin módulos analizados en packages/domain"]);
  });

  it("no confunde un prefijo con otro paquete", () => {
    const result = { modules: [mod("packages/domainx/src/index.ts")], summary: { violations: [] } };
    expect(evaluateCruise(result, ["packages/domain"])).toEqual(["sin módulos analizados en packages/domain"]);
  });

  it("reporta las violaciones de severidad error", () => {
    const result = {
      modules: [mod("apps/web/src/app/page.tsx")],
      summary: { violations: [{ from: "apps/web/src/app/page.tsx", to: "packages/db/src/index.ts", rule: { name: "web", severity: "error" } }] },
    };
    expect(evaluateCruise(result, ["apps/web"])).toEqual(["web: apps/web/src/app/page.tsx → packages/db/src/index.ts"]);
  });
});

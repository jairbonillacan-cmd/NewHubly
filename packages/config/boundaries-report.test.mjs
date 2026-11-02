import { readdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { evaluateCruise } from "./boundaries-report.mjs";

const mod = (source) => ({ source });
const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const RAW_CSS_VALUE_RE =
  /(#[0-9a-fA-F]{3,8}\b|\b(rgb|rgba|hsl|hsla|oklch|lab|lch)\(|\b[0-9]+(\.[0-9]+)?(px|rem|em|vh|vw|vmin|vmax|dvh|svh|lvh|dvw|svw|lvw|ch)\b)/;

function listCssFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".turbo") return [];
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) return listCssFiles(full);
    return entry.name.endsWith(".css") ? [full] : [];
  });
}

export function findCssRawViolations(files) {
  const violations = [];
  for (const file of files) {
    const rel = relative(repoRoot, file).replaceAll("\\", "/");
    if (rel === "packages/ui/src/tokens.css") continue;
    const stripped = readFileSync(file, "utf8").replace(/\/\*[\s\S]*?\*\//g, "");
    const match = RAW_CSS_VALUE_RE.exec(stripped);
    if (match) violations.push(`${rel}: valor suelto "${match[0]}"`);
  }
  return violations;
}

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

  it("prohíbe colores o medidas sueltas en archivos .css fuera de packages/ui/src/tokens.css", () => {
    const cssFiles = [...listCssFiles(resolve(repoRoot, "apps/web")), ...listCssFiles(resolve(repoRoot, "packages/ui"))];
    expect(findCssRawViolations(cssFiles)).toEqual([]);
    expect(RAW_CSS_VALUE_RE.test("color: #ff0000;")).toBe(true);
    expect(RAW_CSS_VALUE_RE.test("min-height: 100dvh;")).toBe(true);
  });
});

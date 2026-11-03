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

const HEROUI_IMPORT_RE = /(from\s+["']@heroui(\/.*)?["']|import\s+["']@heroui(\/.*)?["'])/;
const HEROUI_PRO_IMPORT_RE = /(from\s+["']@heroui-pro(\/.*)?["']|import\s+["']@heroui-pro(\/.*)?["'])/;

function listCodeFiles(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".turbo") return [];
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) return listCodeFiles(full);
    return entry.name.endsWith(".ts") || entry.name.endsWith(".tsx") ? [full] : [];
  });
}

export function findHeroUiViolations(files) {
  const violations = [];
  for (const file of files) {
    const rel = relative(repoRoot, file).replaceAll("\\", "/");
    const content = readFileSync(file, "utf8");
    if (HEROUI_PRO_IMPORT_RE.test(content)) {
      violations.push(`${rel}: importación prohibida de HeroUI Pro (Constitución #4, ADR 0006)`);
    }
    if (!rel.startsWith("packages/ui/") && HEROUI_IMPORT_RE.test(content)) {
      violations.push(`${rel}: @heroui/* solo puede importarse dentro de packages/ui (ADR 0006)`);
    }
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

  it("reporta violaciones de dependencia directa hacia @heroui fuera de packages/ui", () => {
    const result = {
      modules: [mod("apps/web/src/app/page.tsx")],
      summary: {
        violations: [
          {
            from: "apps/web/src/app/page.tsx",
            to: "@heroui/react",
            rule: { name: "heroui-solo-en-ui", severity: "error" },
          },
        ],
      },
    };
    expect(evaluateCruise(result, ["apps/web"])).toEqual([
      "heroui-solo-en-ui: apps/web/src/app/page.tsx → @heroui/react",
    ]);
  });

  it("reporta violaciones de importación de HeroUI Pro en cualquier paquete", () => {
    const result = {
      modules: [mod("packages/ui/src/index.ts")],
      summary: {
        violations: [
          {
            from: "packages/ui/src/index.ts",
            to: "@heroui-pro/react",
            rule: { name: "prohibido-heroui-pro", severity: "error" },
          },
        ],
      },
    };
    expect(evaluateCruise(result, ["packages/ui"])).toEqual([
      "prohibido-heroui-pro: packages/ui/src/index.ts → @heroui-pro/react",
    ]);
  });

  it("prohíbe colores o medidas sueltas en archivos .css fuera de packages/ui/src/tokens.css", () => {
    const cssFiles = [...listCssFiles(resolve(repoRoot, "apps/web")), ...listCssFiles(resolve(repoRoot, "packages/ui"))];
    expect(findCssRawViolations(cssFiles)).toEqual([]);
    expect(RAW_CSS_VALUE_RE.test("color: #ff0000;")).toBe(true);
    expect(RAW_CSS_VALUE_RE.test("min-height: 100dvh;")).toBe(true);
  });

  it("garantiza que ninguna app consume @heroui/* directamente y prohíbe @heroui-pro/* en todo el repo", () => {
    const codeFiles = [
      ...listCodeFiles(resolve(repoRoot, "apps")),
      ...listCodeFiles(resolve(repoRoot, "packages")),
    ];
    expect(findHeroUiViolations(codeFiles)).toEqual([]);
    expect(HEROUI_IMPORT_RE.test('import { Button } from "@heroui/react";')).toBe(true);
    expect(HEROUI_PRO_IMPORT_RE.test('import { ProCard } from "@heroui-pro/react";')).toBe(true);
  });
});


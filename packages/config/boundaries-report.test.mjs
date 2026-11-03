import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  evaluateCruise,
  findHeroUiCodeViolations,
  findHeroUiCssViolations,
  findHeroUiManifestViolations,
  listProjectFiles,
} from "./boundaries-report.mjs";

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

export const findHeroUiViolations = findHeroUiCodeViolations;

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

  it("garantiza que ninguna app consume @heroui/* directamente y prohíbe @heroui-pro / @heroui/pro en todo el repo", () => {
    const codeFiles = [
      ...listProjectFiles(resolve(repoRoot, "apps"), { extensions: [".ts", ".tsx"] }),
      ...listProjectFiles(resolve(repoRoot, "packages"), { extensions: [".ts", ".tsx"] }),
    ];
    expect(findHeroUiViolations(codeFiles, { repoRoot })).toEqual([]);

    // Fixtures sintéticos para asegurar detección de variantes
    const mockViolations = findHeroUiViolations(
      [
        { path: "apps/web/src/component.tsx", content: 'import { Button } from "@heroui/react";' },
        { path: "packages/ui/src/card.tsx", content: 'import { ProCard } from "@heroui-pro/react";' },
        { path: "packages/ui/src/table.tsx", content: 'import { ProTable } from "@heroui/pro";' },
        { path: "packages/ui/src/button.tsx", content: 'import { Button } from "@heroui/react";' },
      ],
      { repoRoot: "" },
    );
    expect(mockViolations).toHaveLength(3);
    expect(mockViolations[0]).toContain("@heroui/* solo puede importarse dentro de packages/ui");
    expect(mockViolations[1]).toContain("importación prohibida de HeroUI Pro");
    expect(mockViolations[2]).toContain("importación prohibida de HeroUI Pro");
  });

  it("prohíbe menciones de HeroUI Pro en cualquier package.json o en pnpm-lock.yaml", () => {
    const manifests = [
      ...(["package.json", "pnpm-lock.yaml"].filter((f) => existsSync(resolve(repoRoot, f))).map((f) => resolve(repoRoot, f))),
      ...listProjectFiles(resolve(repoRoot, "apps"), { names: ["package.json"] }),
      ...listProjectFiles(resolve(repoRoot, "packages"), { names: ["package.json"] }),
    ];
    expect(findHeroUiManifestViolations(manifests, { repoRoot })).toEqual([]);

    // Fixtures sintéticos
    const mockViolations = findHeroUiManifestViolations(
      [
        { path: "packages/ui/package.json", content: '{"dependencies": {"@heroui-pro/react": "^1.0.0"}}' },
        { path: "apps/web/package.json", content: '{"dependencies": {"@heroui/pro": "^1.0.0"}}' },
        { path: "pnpm-lock.yaml", content: "packages:\n  /@heroui-pro/react@1.0.0:\n    resolution: ..." },
        { path: "packages/ui/package.json", content: '{"dependencies": {"@heroui/react": "^3.2.7"}}' },
      ],
      { repoRoot: "" },
    );
    expect(mockViolations).toHaveLength(3);
    expect(mockViolations[0]).toContain("mención prohibida de HeroUI Pro en manifiesto");
    expect(mockViolations[1]).toContain("mención prohibida de HeroUI Pro en manifiesto");
    expect(mockViolations[2]).toContain("mención prohibida de HeroUI Pro en manifiesto");
  });

  it("prohíbe @import de @heroui/styles en archivos CSS fuera de packages/ui y HeroUI Pro en cualquier CSS", () => {
    const cssFiles = [
      ...listProjectFiles(resolve(repoRoot, "apps"), { extensions: [".css"] }),
      ...listProjectFiles(resolve(repoRoot, "packages"), { extensions: [".css"] }),
    ];
    expect(findHeroUiCssViolations(cssFiles, { repoRoot })).toEqual([]);

    // Fixtures sintéticos
    const mockViolations = findHeroUiCssViolations(
      [
        { path: "apps/web/src/app/globals.css", content: '@import "@heroui/styles";' },
        { path: "apps/web/src/app/globals.css", content: "@import url('@heroui/styles');" },
        { path: "packages/ui/src/tokens.css", content: '@import "@heroui-pro/styles";' },
        { path: "packages/ui/src/tokens.css", content: '@import "@heroui/styles";' },
      ],
      { repoRoot: "" },
    );
    expect(mockViolations).toHaveLength(3);
    expect(mockViolations[0]).toContain("@import de @heroui/styles solo está permitido dentro de packages/ui");
    expect(mockViolations[1]).toContain("@import de @heroui/styles solo está permitido dentro de packages/ui");
    expect(mockViolations[2]).toContain("importación prohibida de HeroUI Pro en CSS");
  });

  it("invalida la caché de turbo test cuando cambian archivos CSS en apps/web o packages/ui", () => {
    const turboConfig = JSON.parse(readFileSync(resolve(repoRoot, "turbo.json"), "utf8"));
    expect(turboConfig.tasks?.test?.inputs).toEqual(
      expect.arrayContaining([
        "$TURBO_DEFAULT$",
        "$TURBO_ROOT$/apps/web/**/*.css",
        "$TURBO_ROOT$/packages/ui/**/*.css",
      ]),
    );
  });
});

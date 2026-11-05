import tailwindcssPostcss from "@tailwindcss/postcss";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import { describe, expect, it } from "vitest";
import { tokens } from "./index";

const currentDir = fileURLToPath(new URL(".", import.meta.url));
const tokensCssPath = resolve(currentDir, "tokens.css");
const pkgJsonPath = resolve(currentDir, "../package.json");
const webPkgJsonPath = resolve(currentDir, "../../../apps/web/package.json");
const webPostcssConfigPath = resolve(currentDir, "../../../apps/web/postcss.config.mjs");
const repoRoot = resolve(currentDir, "../../..");

function collectLeafValues(node: unknown): string[] {
  if (typeof node === "string") return [node];
  if (typeof node === "object" && node !== null) return Object.values(node).flatMap(collectLeafValues);
  return [];
}

function listFilesRecursively(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    return statSync(full).isDirectory() ? listFilesRecursively(full) : [full];
  });
}

describe("tokens semánticos de @hubly/ui, paleta Grafito y azul tinta (#52) e integración con HeroUI v3 OSS (ADR 0006)", () => {
  it("expone únicamente referencias var(--*) sin colores ni medidas sueltas", () => {
    const values = collectLeafValues(tokens);
    expect(values.length).toBeGreaterThan(25);
    for (const val of values) {
      expect(val).toMatch(/^var\(--[a-z0-9-]+\)$/);
    }
  });

  it("cubre superficies, texto, bordes (incluido borderControl), acento azul tinta, tipografía, espacio, radios y foco", () => {
    expect(tokens.color.surfaceCanvas).toBe("var(--surface-canvas)");
    expect(tokens.color.textPrimary).toBe("var(--text-primary)");
    expect(tokens.color.borderDefault).toBe("var(--border-default)");
    expect(tokens.color.borderControl).toBe("var(--border-control)");
    expect(tokens.color.accentPrimary).toBe("var(--accent-primary)");
    expect(tokens.color.accentPrimarySubtle).toBe("var(--accent-primary-subtle)");
    expect(tokens.focus.ringColor).toBe("var(--focus-ring-color)");
    expect(tokens.space[4]).toBe("var(--space-4)");
    expect(tokens.radius.md).toBe("var(--radius-md)");
    expect(tokens.layout.viewportHeight).toBe("var(--measure-viewport-height)");
  });

  it("instala HeroUI v3 OSS, Tailwind 4, @tailwindcss/postcss y peer dependencies con versiones exactas y sin HeroUI Pro", () => {
    const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8")) as { scripts?: Record<string, string>; dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const webPkg = JSON.parse(readFileSync(webPkgJsonPath, "utf8")) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
    const deps = pkg.dependencies ?? {};
    for (const name of ["@heroui/react", "@heroui/styles", "@internationalized/date", "@react-aria/ssr", "@react-aria/utils", "react-aria", "react-aria-components", "tailwind-variants", "tailwindcss"]) {
      expect(deps[name]).toMatch(/^\d+\.\d+\.\d+$/);
    }
    expect(pkg.devDependencies?.["@tailwindcss/postcss"]).toBe(deps["tailwindcss"]);
    expect(webPkg.devDependencies?.["@tailwindcss/postcss"]).toBe(deps["tailwindcss"]);
    expect(existsSync(webPostcssConfigPath)).toBe(true);
    expect(readFileSync(webPostcssConfigPath, "utf8")).toContain("@tailwindcss/postcss");
    expect(pkg.devDependencies?.["storybook"]).toMatch(/^\d+\.\d+\.\d+$/);
    expect(pkg.devDependencies?.["@storybook/react-vite"]).toBe(pkg.devDependencies?.["storybook"]);
    expect(pkg.scripts?.["build-storybook"]).toBe("storybook build -o storybook-static");
    const previewContent = readFileSync(resolve(currentDir, "../.storybook/preview.tsx"), "utf8");
    expect(previewContent).toContain("../src/tokens.css");
    expect(previewContent).toContain("desktop1440");
    expect(previewContent).toContain("mobile390");
    for (const story of ["Brand.stories.tsx", "Landing.stories.tsx", "Espacio.stories.tsx"]) {
      expect(existsSync(resolve(currentDir, "stories", story))).toBe(true);
    }

    const allDeps = { ...deps, ...(pkg.devDependencies ?? {}), ...(webPkg.dependencies ?? {}), ...(webPkg.devDependencies ?? {}) };
    for (const [name, version] of Object.entries(allDeps)) {
      expect(name).not.toMatch(/@heroui(-|\/)pro\b/);
      if (version !== "workspace:*") expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    }
  });

  it("deriva el tema de HeroUI v3 en tokens.css exclusivamente desde tokens reales de @hubly/ui sin valores sueltos", () => {
    const css = readFileSync(tokensCssPath, "utf8");
    expect(css).toContain('@import "tailwindcss";');
    expect(css).toContain('@import "@heroui/styles";');
    expect(css).toContain('@source "../../../packages/ui/src/**/*.{ts,tsx}";');
    expect(css).toContain('@source "../../../apps/web/src/**/*.{ts,tsx}";');
    expect(css).not.toMatch(/@heroui(-|\/)pro\b/);

    const rootBlockMatch = /:root\s*\{([\s\S]*?)\}/.exec(css);
    const declaredTokens = new Set(Array.from((rootBlockMatch?.[1] ?? "").matchAll(/(--[a-z0-9-]+)\s*:/g), (m) => m[1]));
    const heroUiBlockMatch = /\[data-theme="default"\],\s*\.dark,\s*\[data-theme="dark"\]\s*\{([\s\S]*?)\}/.exec(css);
    const declarations = Array.from((heroUiBlockMatch?.[1] ?? "").matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g));
    expect(declarations.length).toBeGreaterThanOrEqual(40);
    for (const [, prop, rawVal] of declarations) {
      const val = (rawVal ?? "").trim();
      expect(val, `Propiedad ${prop} debe referenciar var(--*)`).toMatch(/^var\(--[a-z0-9-]+\)$/);
      const targetToken = val.slice(4, -1);
      expect(targetToken).not.toMatch(/^--color-/);
      expect(declaredTokens.has(targetToken), `Token ${targetToken} referenciado en ${prop} no existe en :root`).toBe(true);
    }
  });

  it("no contiene ningún color retirado (terracota, naranja cálido, verde petróleo o crema antiguo) en packages/ui, apps/web ni docs/diseno (#52)", () => {
    const retiredHexCodes = [
      "7a2e22", "341612", "8f3a2c", "441c17", "c25218", "f08344", "a84411", "ffa066",
      "faeee6", "361c10", "87340d", "fcc29f", "1f4f46", "173d36", "183f38", "6ec4b3",
      "8bd2c4", "58c9b4", "7ed9c7", "fdfbf7", "1c1917",
    ];
    const retiredPattern = new RegExp(`#(${retiredHexCodes.join("|")})\\b|--accent-warm\\b`, "i");
    const selfPath = resolve(currentDir, "tokens.test.ts");
    const filesToScan = [
      ...listFilesRecursively(resolve(repoRoot, "packages/ui/src")),
      ...listFilesRecursively(resolve(repoRoot, "apps/web/src")),
      ...listFilesRecursively(resolve(repoRoot, "docs/diseno")),
    ].filter((file) => resolve(file) !== selfPath);
    expect(filesToScan.length).toBeGreaterThan(10);
    for (const file of filesToScan) {
      const content = readFileSync(file, "utf8");
      expect(content, `Color o token retirado detectado en ${file}`).not.toMatch(retiredPattern);
    }
  });

  it("compila tokens.css con PostCSS + @tailwindcss/postcss generando estilos reales de HeroUI sin directivas sin procesar", async () => {
    const css = readFileSync(tokensCssPath, "utf8");
    const result = await postcss([tailwindcssPostcss()]).process(css, { from: tokensCssPath });
    expect(result.css).not.toMatch(/@(import|theme|source|utility|tailwind)\b/);
    expect(result.css).toContain(".button");
    expect(result.css).toContain("--background: var(--surface-canvas)");
    expect(result.css).toContain("--field-border: var(--border-control)");
  });
});

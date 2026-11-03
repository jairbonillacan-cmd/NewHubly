import tailwindcssPostcss from "@tailwindcss/postcss";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import postcss from "postcss";
import { describe, expect, it } from "vitest";
import { tokens } from "./index";

const currentDir = fileURLToPath(new URL(".", import.meta.url));
const tokensCssPath = resolve(currentDir, "tokens.css");
const pkgJsonPath = resolve(currentDir, "../package.json");
const webPkgJsonPath = resolve(currentDir, "../../../apps/web/package.json");
const webPostcssConfigPath = resolve(currentDir, "../../../apps/web/postcss.config.mjs");

function collectLeafValues(node: unknown): string[] {
  if (typeof node === "string") {
    return [node];
  }
  if (typeof node === "object" && node !== null) {
    return Object.values(node).flatMap(collectLeafValues);
  }
  return [];
}

describe("tokens semánticos de @hubly/ui e integración con HeroUI v3 OSS (ADR 0006)", () => {
  it("expone únicamente referencias var(--*) sin colores ni medidas sueltas", () => {
    const values = collectLeafValues(tokens);
    expect(values.length).toBeGreaterThan(25);
    for (const val of values) {
      expect(val).toMatch(/^var\(--[a-z0-9-]+\)$/);
    }
  });

  it("cubre superficies, texto, bordes (incluido borderControl), tipografía, espacio, radios, foco y alto de ventana", () => {
    expect(tokens.color.surfaceCanvas).toBe("var(--surface-canvas)");
    expect(tokens.color.textPrimary).toBe("var(--text-primary)");
    expect(tokens.color.borderDefault).toBe("var(--border-default)");
    expect(tokens.color.borderControl).toBe("var(--border-control)");
    expect(tokens.focus.ringColor).toBe("var(--focus-ring-color)");
    expect(tokens.space[4]).toBe("var(--space-4)");
    expect(tokens.radius.md).toBe("var(--radius-md)");
    expect(tokens.layout.viewportHeight).toBe("var(--measure-viewport-height)");
  });

  it("instala HeroUI v3 OSS, Tailwind 4, @tailwindcss/postcss y peer dependencies con versiones exactas y sin HeroUI Pro", () => {
    const pkg = JSON.parse(readFileSync(pkgJsonPath, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const webPkg = JSON.parse(readFileSync(webPkgJsonPath, "utf8")) as {
      dependencies?: Record<string, string>;
      devDependencies?: Record<string, string>;
    };
    const deps = pkg.dependencies ?? {};
    const requiredPackages = [
      "@heroui/react",
      "@heroui/styles",
      "@internationalized/date",
      "@react-aria/ssr",
      "@react-aria/utils",
      "react-aria",
      "react-aria-components",
      "tailwind-variants",
      "tailwindcss",
    ];
    for (const name of requiredPackages) {
      expect(deps[name]).toBeDefined();
      expect(deps[name]).toMatch(/^\d+\.\d+\.\d+$/);
    }
    expect(pkg.devDependencies?.["@tailwindcss/postcss"]).toBe(deps["tailwindcss"]);
    expect(webPkg.devDependencies?.["@tailwindcss/postcss"]).toBe(deps["tailwindcss"]);
    expect(existsSync(webPostcssConfigPath)).toBe(true);
    expect(readFileSync(webPostcssConfigPath, "utf8")).toContain("@tailwindcss/postcss");

    const allDeps = { ...deps, ...(pkg.devDependencies ?? {}), ...(webPkg.dependencies ?? {}), ...(webPkg.devDependencies ?? {}) };
    for (const [name, version] of Object.entries(allDeps)) {
      expect(name).not.toMatch(/@heroui(-|\/)pro\b/);
      if (version !== "workspace:*") {
        expect(version).toMatch(/^\d+\.\d+\.\d+$/);
      }
    }
  });

  it("deriva el tema de HeroUI v3 en tokens.css exclusivamente desde tokens reales de @hubly/ui sin valores sueltos", () => {
    const css = readFileSync(tokensCssPath, "utf8");
    expect(css).toContain('@import "tailwindcss";');
    expect(css).toContain('@import "@heroui/styles";');
    expect(css).toContain('@source "../../../packages/ui/src/**/*.{ts,tsx}";');
    expect(css).toContain('@source "../../../apps/web/src/**/*.{ts,tsx}";');
    expect(css).not.toMatch(/@heroui(-|\/)pro\b/);
    expect(css).toMatch(/--space-1:\s*0\.25rem;/);

    const rootBlockMatch = /:root\s*\{([\s\S]*?)\}/.exec(css);
    expect(rootBlockMatch).not.toBeNull();
    const declaredTokens = new Set(
      Array.from((rootBlockMatch?.[1] ?? "").matchAll(/(--[a-z0-9-]+)\s*:/g), (m) => m[1]),
    );

    const heroUiBlockMatch = /\[data-theme="default"\],\s*\.dark,\s*\[data-theme="dark"\]\s*\{([\s\S]*?)\}/.exec(css);
    expect(heroUiBlockMatch).not.toBeNull();
    const heroUiBody = heroUiBlockMatch?.[1] ?? "";

    const declarations = Array.from(heroUiBody.matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g));
    expect(declarations.length).toBeGreaterThanOrEqual(40);
    for (const [, prop, rawVal] of declarations) {
      const val = (rawVal ?? "").trim();
      expect(val, `Propiedad ${prop} debe referenciar var(--*)`).toMatch(/^var\(--[a-z0-9-]+\)$/);
      const targetToken = val.slice(4, -1);
      expect(targetToken).not.toMatch(/^--color-/);
      expect(declaredTokens.has(targetToken), `Token ${targetToken} referenciado en ${prop} no existe en :root`).toBe(
        true,
      );
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

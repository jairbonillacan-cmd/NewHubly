import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  ALLOWED_BROWSER_STORAGE_KEYS,
  KNOWN_APP_ROUTES,
  evaluateCruise,
  findBrowserStorageAndTokenViolations,
  findClientDatabaseViolations,
  findHardcodedTenantViolations,
  findHeroUiCodeViolations,
  findHeroUiCssViolations,
  findHeroUiManifestViolations,
  findOrphanRouteViolations,
  findUnsanitizedHtmlViolations,
  listProjectFiles,
  routePathFromAppFile,
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

describe("Reglas de CI de higiene de rutas y fronteras de cliente (#69)", () => {
  const allCodeFiles = [
    ...listProjectFiles(resolve(repoRoot, "apps"), { extensions: [".ts", ".tsx", ".mjs"] }),
    ...listProjectFiles(resolve(repoRoot, "packages"), { extensions: [".ts", ".tsx", ".mjs"] }),
  ];

  it("Regla 1 (Sin rutas huérfanas): verifica todas las rutas reales de apps/web/src/app y detecta rutas no registradas o sin enlaces", () => {
    expect(routePathFromAppFile("apps/web/src/app/page.tsx")).toBe("/");
    expect(routePathFromAppFile("apps/web/src/app/(workspace)/hoy/page.tsx")).toBe("/hoy");
    expect(routePathFromAppFile("apps/web/src/app/(public)/login/page.tsx")).toBe("/login");
    expect(routePathFromAppFile("apps/web/src/app/auth/callback/route.ts")).toBe("/auth/callback");

    const routeFiles = listProjectFiles(resolve(repoRoot, "apps/web/src/app"), { names: ["page.tsx", "route.ts"] });
    const webSourceFiles = listProjectFiles(resolve(repoRoot, "apps/web/src"), { extensions: [".ts", ".tsx"] });
    expect(findOrphanRouteViolations(routeFiles, webSourceFiles, { repoRoot })).toEqual([]);
    expect(KNOWN_APP_ROUTES.has("/hoy")).toBe(true);

    const violations = findOrphanRouteViolations(
      [
        { path: "apps/web/src/app/page.tsx", content: '<a href="/hoy">Hoy</a>' },
        { path: "apps/web/src/app/(workspace)/hoy/page.tsx", content: "export default function Hoy() {}" },
        { path: "apps/web/src/app/vieja-pantalla/page.tsx", content: "export default function Vieja() {}" },
        { path: "apps/web/src/app/(public)/terminos/page.tsx", content: "export default function Terminos() {}" },
      ],
      [{ path: "apps/web/src/app/page.tsx", content: '<a href="/hoy">Hoy</a>' }],
      { repoRoot: "" },
    );
    expect(violations).toHaveLength(3);
    expect(violations[0]).toContain('la ruta "/vieja-pantalla" no está registrada en KNOWN_APP_ROUTES');
    expect(violations[1]).toContain('la ruta "/vieja-pantalla" es huérfana');
    expect(violations[2]).toContain('la ruta "/terminos" es huérfana');
  });

  it("Regla 2 (Base de datos solo en servidor): prohíbe importar @hubly/db, Supabase o Drizzle en archivos con 'use client'", () => {
    expect(findClientDatabaseViolations(allCodeFiles, { repoRoot })).toEqual([]);

    const violations = findClientDatabaseViolations(
      [
        { path: "apps/web/src/server/db.ts", content: 'import { createDb } from "@hubly/db";' },
        { path: "apps/web/src/components/OkClient.tsx", content: '"use client";\nimport { Button } from "@hubly/ui";' },
        { path: "apps/web/src/components/BadDb.tsx", content: '"use client";\nimport { notes } from "@hubly/db";' },
        { path: "apps/web/src/components/BadSupa.tsx", content: "'use client';\nimport { createBrowserClient } from '@supabase/ssr';" },
        { path: "apps/web/src/components/BadDrizzle.tsx", content: '"use client";\nimport { eq } from "drizzle-orm";' },
      ],
      { repoRoot: "" },
    );
    expect(violations).toHaveLength(3);
    expect(violations[0]).toContain('no puede importar "@hubly/db"');
    expect(violations[1]).toContain('no puede importar "@supabase/ssr"');
    expect(violations[2]).toContain('no puede importar "drizzle-orm"');
  });

  it("Regla 3 (Nada de sesión ni tokens en el navegador): permite solo claves en lista blanca y prohíbe exponer tokens en Server Actions", () => {
    expect(findBrowserStorageAndTokenViolations(allCodeFiles, { repoRoot })).toEqual([]);
    expect(ALLOWED_BROWSER_STORAGE_KEYS.has("hubly-theme")).toBe(true);
    expect(ALLOWED_BROWSER_STORAGE_KEYS.has("hubly_tz_refresh_attempted")).toBe(true);

    const violations = findBrowserStorageAndTokenViolations(
      [
        {
          path: "packages/ui/src/ThemeToggle.tsx",
          content: 'const K = "hubly-theme"; localStorage.getItem(K); localStorage.setItem("hubly-theme", "dark");',
        },
        {
          path: "apps/web/src/components/BadStorage.tsx",
          content: 'localStorage.setItem("sb-access-token", tok); sessionStorage.getItem("otra_clave"); localStorage.auth_jwt = "x";',
        },
        {
          path: "apps/web/src/actions/ok.ts",
          content: '"use server";\nexport async function act() { return { ok: true }; }',
        },
        {
          path: "apps/web/src/actions/leak.ts",
          content: '"use server";\nexport async function bad() { return { access_token: "secreto" }; }',
        },
      ],
      { repoRoot: "" },
    );
    expect(violations).toHaveLength(4);
    expect(violations[0]).toContain('clave "sb-access-token" no permitida');
    expect(violations[1]).toContain('clave "otra_clave" no permitida');
    expect(violations[2]).toContain('clave "auth_jwt" no permitida');
    expect(violations[3]).toContain('Server Action ("use server") no puede exponer ni manipular el campo de token "access_token"');
  });

  it("Regla 4 (Nada fijo de un cliente en código): prohíbe UUIDs literales, correos y condicionales por cliente fuera de pruebas", () => {
    expect(findHardcodedTenantViolations(allCodeFiles, { repoRoot })).toEqual([]);

    const violations = findHardcodedTenantViolations(
      [
        { path: "apps/web/src/app/(public)/login/page.tsx", content: '<Input placeholder="equipo@agencia.es" />' },
        { path: "apps/web/tests/fixture.test.ts", content: 'const id = "550e8400-e29b-41d4-a716-446655440000"; const e = "a@b.com";' },
        { path: "packages/application/src/bad-uuid.ts", content: 'const FIXED = "550e8400-e29b-41d4-a716-446655440000";' },
        { path: "packages/application/src/bad-email.ts", content: 'const VIP = "vip@cliente.com";' },
        { path: "packages/application/src/bad-branch.ts", content: 'if (workspaceId === "agencia-especial") { return true; }' },
      ],
      { repoRoot: "" },
    );
    expect(violations).toHaveLength(3);
    expect(violations[0]).toContain("UUID literal");
    expect(violations[1]).toContain('correo electrónico literal "vip@cliente.com"');
    expect(violations[2]).toContain("condicional por identificador o nombre de cliente/agencia fijo");
  });

  it("Regla 5 (Sin HTML sin sanitizar): prohíbe dangerouslySetInnerHTML sin justificación e innerHTML en código y en ESLint", () => {
    expect(findUnsanitizedHtmlViolations(allCodeFiles, { repoRoot })).toEqual([]);
    const eslintSource = readFileSync(resolve(repoRoot, "packages/config/eslint.config.mjs"), "utf8");
    expect(eslintSource).toContain("JSXAttribute[name.name='dangerouslySetInnerHTML']");
    expect(eslintSource).toContain("AssignmentExpression[left.property.name='innerHTML']");

    const violations = findUnsanitizedHtmlViolations(
      [
        {
          path: "apps/web/src/app/layout.tsx",
          content: "// hubly-allow-dangerously-set-inner-html: script de tema estático sin entrada de usuario\n<script dangerouslySetInnerHTML={{ __html: code }} />",
        },
        { path: "apps/web/src/components/BadHtml.tsx", content: "<div dangerouslySetInnerHTML={{ __html: raw }} />" },
        { path: "apps/web/src/components/BadDom.ts", content: "el.innerHTML = rawUserText;" },
      ],
      { repoRoot: "" },
    );
    expect(violations).toHaveLength(2);
    expect(violations[0]).toContain("uso prohibido de dangerouslySetInnerHTML sin comentario de excepción justificado");
    expect(violations[1]).toContain("asignación directa a innerHTML/outerHTML prohibida");
  });
});

// Evalúa el resultado JSON de dependency-cruiser y las reglas de fronteras complementarias (ADR 0002 / ADR 0006).
// Falla si hay violaciones, si algún paquete no fue analizado, si se detecta HeroUI Pro
// en código, manifiestos o lockfile, o si @heroui/styles se importa fuera de packages/ui.
import { readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";

export function evaluateCruise(result, expectedRoots) {
  const problems = [];
  const modules = result?.modules ?? [];
  const violations = result?.summary?.violations ?? [];

  for (const v of violations) {
    if (v.rule?.severity === "error") problems.push(`${v.rule.name}: ${v.from} → ${v.to}`);
  }
  if (modules.length === 0) problems.push("dependency-cruiser no analizó ningún módulo");
  for (const root of expectedRoots) {
    if (!modules.some((m) => m.source.startsWith(`${root}/`))) problems.push(`sin módulos analizados en ${root}`);
  }
  return problems;
}

const HEROUI_PRO_RE = /@heroui(-|\/)pro\b/;
const HEROUI_CSS_IMPORT_RE = /@import\s+(?:url\()?["']@heroui(\/styles)?/;
const HEROUI_CODE_IMPORT_RE = /(from\s+["']@heroui(\/.*)?["']|import\s+["']@heroui(\/.*)?["'])/;
const HEROUI_PRO_CODE_IMPORT_RE = /(from\s+["']@heroui(-|\/)pro(\/.*)?["']|import\s+["']@heroui(-|\/)pro(\/.*)?["'])/;

export function listProjectFiles(dir, filter = {}) {
  const entries = readdirSync(dir, { withFileTypes: true });
  return entries.flatMap((entry) => {
    if (entry.name === "node_modules" || entry.name === ".next" || entry.name === ".turbo" || entry.name === ".git") return [];
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) return listProjectFiles(full, filter);
    const nameMatch = filter.names ? filter.names.includes(entry.name) : false;
    const extMatch = filter.extensions ? filter.extensions.some((ext) => entry.name.endsWith(ext)) : false;
    return nameMatch || extMatch ? [full] : [];
  });
}

export function findHeroUiManifestViolations(files, options = {}) {
  const repoRoot = options.repoRoot ?? process.cwd();
  const readFile = options.readFile ?? ((f) => readFileSync(f, "utf8"));
  const violations = [];
  for (const item of files) {
    const filePath = typeof item === "string" ? item : item.path;
    const rel = relative(repoRoot, filePath).replaceAll("\\", "/");
    const content = typeof item === "string" ? readFile(filePath) : item.content;
    if (HEROUI_PRO_RE.test(content)) {
      violations.push(`${rel}: mención prohibida de HeroUI Pro en manifiesto (Constitución #4, ADR 0006)`);
    }
  }
  return violations;
}

export function findHeroUiCssViolations(files, options = {}) {
  const repoRoot = options.repoRoot ?? process.cwd();
  const readFile = options.readFile ?? ((f) => readFileSync(f, "utf8"));
  const violations = [];
  for (const item of files) {
    const filePath = typeof item === "string" ? item : item.path;
    const rel = relative(repoRoot, filePath).replaceAll("\\", "/");
    const content = typeof item === "string" ? readFile(filePath) : item.content;
    if (HEROUI_PRO_RE.test(content)) {
      violations.push(`${rel}: importación prohibida de HeroUI Pro en CSS (Constitución #4, ADR 0006)`);
    }
    if (!rel.startsWith("packages/ui/") && HEROUI_CSS_IMPORT_RE.test(content)) {
      violations.push(`${rel}: @import de @heroui/styles solo está permitido dentro de packages/ui (ADR 0006)`);
    }
  }
  return violations;
}

export function findHeroUiCodeViolations(files, options = {}) {
  const repoRoot = options.repoRoot ?? process.cwd();
  const readFile = options.readFile ?? ((f) => readFileSync(f, "utf8"));
  const violations = [];
  for (const item of files) {
    const filePath = typeof item === "string" ? item : item.path;
    const rel = relative(repoRoot, filePath).replaceAll("\\", "/");
    const content = typeof item === "string" ? readFile(filePath) : item.content;
    if (HEROUI_PRO_CODE_IMPORT_RE.test(content)) {
      violations.push(`${rel}: importación prohibida de HeroUI Pro (Constitución #4, ADR 0006)`);
    }
    if (!rel.startsWith("packages/ui/") && HEROUI_CODE_IMPORT_RE.test(content)) {
      violations.push(`${rel}: @heroui/* solo puede importarse dentro de packages/ui (ADR 0006)`);
    }
  }
  return violations;
}

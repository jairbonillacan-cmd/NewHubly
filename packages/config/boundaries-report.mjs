// Evalúa el resultado JSON de dependency-cruiser y las reglas de fronteras e higiene de CI (ADR 0002, ADR 0006, Issue #69).
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

// Regla 1 (#69): Registro explícito y documentado de rutas vigentes en apps/web/src/app.
export const KNOWN_APP_ROUTES = new Map([
  ["/", "Página principal pública (landing)"],
  ["/hoy", "Espacio de trabajo operativo (vista Hoy)"],
  ["/login", "Inicio de sesión, registro y enlace mágico"],
  ["/privacidad", "Política de privacidad pública"],
  ["/terminos", "Términos del servicio públicos"],
  ["/auth/callback", "Callback de intercambio de código de autenticación"],
]);

// Regla 3 (#69): Lista blanca explícita de claves de preferencias de interfaz en localStorage/sessionStorage.
export const ALLOWED_BROWSER_STORAGE_KEYS = new Set(["hubly-theme", "hubly_tz_refresh_attempted", "hubly-espacio"]);

// Regla 4 (#69): Placeholders neutros de interfaz permitidos únicamente en atributos placeholder="...".
export const ALLOWED_UI_PLACEHOLDER_EMAILS = new Set(["equipo@agencia.es"]);

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

function normalizeItems(files, options = {}) {
  const repoRoot = options.repoRoot ?? process.cwd();
  const readFile = options.readFile ?? ((f) => readFileSync(f, "utf8"));
  return files.map((item) => {
    const filePath = typeof item === "string" ? item : item.path;
    const rel = (repoRoot ? relative(repoRoot, filePath) : filePath).replaceAll("\\", "/");
    const content = typeof item === "string" ? readFile(filePath) : item.content;
    return { rel, content };
  });
}

export function isProductionCodePath(rel) {
  if (rel.startsWith("packages/config/") || rel.endsWith(".d.ts") || rel.endsWith(".sql")) return false;
  if (/(^|\/)(tests|__tests__|drizzle|migrations)\//.test(rel)) return false;
  return !/\.(test|spec|stories)\.[cm]?[jt]sx?$/.test(rel);
}

function stripComments(source) {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

export function findHeroUiManifestViolations(files, options = {}) {
  const violations = [];
  for (const { rel, content } of normalizeItems(files, options)) {
    if (HEROUI_PRO_RE.test(content)) {
      violations.push(`${rel}: mención prohibida de HeroUI Pro en manifiesto (Constitución #4, ADR 0006)`);
    }
  }
  return violations;
}

export function findHeroUiCssViolations(files, options = {}) {
  const violations = [];
  for (const { rel, content } of normalizeItems(files, options)) {
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
  const violations = [];
  for (const { rel, content } of normalizeItems(files, options)) {
    if (rel.startsWith("packages/config/")) continue;
    if (HEROUI_PRO_CODE_IMPORT_RE.test(content)) {
      violations.push(`${rel}: importación prohibida de HeroUI Pro (Constitución #4, ADR 0006)`);
    }
    if (!rel.startsWith("packages/ui/") && HEROUI_CODE_IMPORT_RE.test(content)) {
      violations.push(`${rel}: @heroui/* solo puede importarse dentro de packages/ui (ADR 0006)`);
    }
  }
  return violations;
}

export function routePathFromAppFile(relPath) {
  const normalized = relPath.replaceAll("\\", "/").replace(/^.*?apps\/web\/src\/app\/?/, "");
  const withoutLeaf = normalized.replace(/(?:^|\/)(page\.tsx|route\.ts)$/, "");
  const segments = withoutLeaf
    .split("/")
    .filter((seg) => seg.length > 0 && !(seg.startsWith("(") && seg.endsWith(")")));
  return segments.length === 0 ? "/" : `/${segments.join("/")}`;
}

// Regla 1 (#69): Sin rutas huérfanas en apps/web/src/app.
export function findOrphanRouteViolations(routeFiles, appSourceFiles = [], options = {}) {
  const knownRoutes = options.knownRoutes ?? KNOWN_APP_ROUTES;
  const routes = normalizeItems(routeFiles, options);
  const sources = normalizeItems(appSourceFiles, options);
  const violations = [];

  for (const { rel } of routes) {
    const route = routePathFromAppFile(rel);
    if (!knownRoutes.has(route)) {
      violations.push(
        `${rel}: la ruta "${route}" no está registrada en KNOWN_APP_ROUTES (#69). Al retirar una pantalla se debe borrar su ruta y añadir redirección permanente en next.config.ts.`,
      );
    }
    if (route !== "/") {
      const escaped = route.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const refRe = new RegExp(`["'\`][^"'\`]*${escaped}(?:["'\`/?#]|$)`);
      const isReferenced = sources.some((src) => src.rel !== rel && refRe.test(src.content));
      if (!isReferenced) {
        violations.push(
          `${rel}: la ruta "${route}" es huérfana (sin enlaces ni referencias en apps/web/src). Enlázala o elimínala con redirección permanente en next.config.ts (#69).`,
        );
      }
    }
  }
  return violations;
}

// Regla 2 (#69): La base de datos y clientes de Supabase solo se tocan en el servidor.
const FORBIDDEN_CLIENT_DB_IMPORT_RE =
  /(?:from\s+["']|import\s*\(\s*["']|require\s*\(\s*["'])(@hubly\/db(?:\/[^"']*)?|@supabase\/supabase-js(?:\/[^"']*)?|@supabase\/ssr(?:\/[^"']*)?|drizzle-orm(?:\/[^"']*)?|postgres(?:\/[^"']*)?)["']/g;

export function findClientDatabaseViolations(files, options = {}) {
  const violations = [];
  for (const { rel, content } of normalizeItems(files, options)) {
    if (!isProductionCodePath(rel)) continue;
    const stripped = stripComments(content).trimStart();
    if (!/^["']use client["']\s*;?/.test(stripped)) continue;
    for (const match of stripped.matchAll(FORBIDDEN_CLIENT_DB_IMPORT_RE)) {
      violations.push(`${rel}: archivo con "use client" no puede importar "${match[1]}"; la base de datos y sesión solo se tocan en el servidor (#69)`);
    }
  }
  return violations;
}

// Regla 3 (#69): Nada de sesión ni tokens en el navegador ni exposición de tokens desde Server Actions.
const SENSITIVE_STORAGE_KEY_RE = /(token|session|auth|jwt|secret|credential|supabase|access_token|refresh_token)/i;
const SERVER_ACTION_TOKEN_LEAK_RE = /\b(access_token|refresh_token|provider_token|provider_refresh_token|token_hash|client_secret)\b/;
const STORAGE_CALL_RE = /\b(?:localStorage|sessionStorage|storage)\s*\??\.\s*(?:getItem|setItem|removeItem)\s*\(\s*([^,)\s]+)/g;
const STORAGE_BRACKET_RE = /\b(?:localStorage|sessionStorage)\s*\[\s*([^\]]+)\s*\]/g;
const STORAGE_PROP_RE = /\b(?:localStorage|sessionStorage)\s*\.\s*(?!getItem\b|setItem\b|removeItem\b|clear\b|key\b|length\b)([a-zA-Z_$][\w$]*)/g;

export function findBrowserStorageAndTokenViolations(files, options = {}) {
  const allowedKeys = options.allowedKeys ?? ALLOWED_BROWSER_STORAGE_KEYS;
  const violations = [];

  for (const { rel, content } of normalizeItems(files, options)) {
    if (!isProductionCodePath(rel)) continue;
    const stripped = stripComments(content);
    const localConsts = new Map();
    for (const m of stripped.matchAll(/\bconst\s+([A-Za-z_$][\w$]*)\s*=\s*["']([^"']+)["']/g)) {
      localConsts.set(m[1], m[2]);
    }

    const rawArgs = [
      ...[...stripped.matchAll(STORAGE_CALL_RE)].map((m) => m[1]),
      ...[...stripped.matchAll(STORAGE_BRACKET_RE)].map((m) => m[1]?.trim()),
      ...[...stripped.matchAll(STORAGE_PROP_RE)].map((m) => `"${m[1]}"`),
    ];

    for (const rawKey of rawArgs) {
      if (!rawKey) continue;
      const literalMatch = /^["'`]([^"'`]+)["'`]$/.exec(rawKey);
      const resolvedKey = literalMatch ? literalMatch[1] : localConsts.get(rawKey) ?? rawKey;
      if (SENSITIVE_STORAGE_KEY_RE.test(resolvedKey) || !allowedKeys.has(resolvedKey)) {
        violations.push(
          `${rel}: clave "${resolvedKey}" no permitida en localStorage/sessionStorage; prohibido guardar sesión/tokens en el navegador y solo se admiten preferencias en ALLOWED_BROWSER_STORAGE_KEYS (#69)`,
        );
      }
    }

    if (/^["']use server["']\s*;?/.test(stripped.trimStart())) {
      const leakMatch = SERVER_ACTION_TOKEN_LEAK_RE.exec(stripped);
      if (leakMatch) {
        violations.push(`${rel}: Server Action ("use server") no puede exponer ni manipular el campo de token "${leakMatch[1]}" hacia el cliente (#69)`);
      }
    }
  }
  return violations;
}

// Regla 4 (#69): Nada fijo de un cliente en código de producción (UUIDs, correos o condicionales por cliente/agencia).
const UUID_LITERAL_RE = /\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/i;
const EMAIL_LITERAL_RE = /["'`][^"'`\n]*\b([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})\b[^"'`\n]*["'`]/g;
const TENANT_BRANCH_RE =
  /\b(?:workspaceId|workspace_id|tenantId|tenant_id|clientId|client_id|agencyId|agency_id|workspaceName|agencyName|clientName)\s*(?:===|!==|==|!=)\s*["'`][^"'`]+["'`]|["'`][^"'`]+["'`]\s*(?:===|!==|==|!=)\s*\b(?:workspaceId|workspace_id|tenantId|tenant_id|clientId|client_id|agencyId|agency_id|workspaceName|agencyName|clientName)\b/;

export function findHardcodedTenantViolations(files, options = {}) {
  const allowedPlaceholders = options.allowedPlaceholderEmails ?? ALLOWED_UI_PLACEHOLDER_EMAILS;
  const violations = [];

  for (const { rel, content } of normalizeItems(files, options)) {
    if (!isProductionCodePath(rel)) continue;
    const stripped = stripComments(content);

    const uuidMatch = UUID_LITERAL_RE.exec(stripped);
    if (uuidMatch) {
      violations.push(`${rel}: UUID literal "${uuidMatch[0]}" prohibido en código de producción (#69)`);
    }

    const withoutAllowedPlaceholders = stripped.replace(/placeholder\s*=\s*["']([^"']+)["']/g, (full, email) =>
      allowedPlaceholders.has(email) ? 'placeholder=""' : full,
    );
    for (const emailMatch of withoutAllowedPlaceholders.matchAll(EMAIL_LITERAL_RE)) {
      violations.push(`${rel}: correo electrónico literal "${emailMatch[1]}" prohibido en código de producción (#69)`);
    }

    if (TENANT_BRANCH_RE.test(stripped)) {
      violations.push(`${rel}: condicional por identificador o nombre de cliente/agencia fijo prohibido en código de producción (#69)`);
    }
  }
  return violations;
}

// Regla 5 (#69): Sin HTML sin sanitizar (dangerouslySetInnerHTML o asignación a innerHTML/outerHTML).
const JUSTIFIED_DANGER_COMMENT_RE = /hubly-allow-dangerously-set-inner-html:\s*\S+/;

export function findUnsanitizedHtmlViolations(files, options = {}) {
  const violations = [];
  for (const { rel, content } of normalizeItems(files, options)) {
    if (!isProductionCodePath(rel)) continue;
    const lines = content.split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i] ?? "";
      const prevLine = i > 0 ? (lines[i - 1] ?? "") : "";
      if (/\bdangerouslySetInnerHTML\b/.test(line)) {
        const justified = JUSTIFIED_DANGER_COMMENT_RE.test(line) || JUSTIFIED_DANGER_COMMENT_RE.test(prevLine);
        if (!justified) {
          violations.push(`${rel}:${i + 1}: uso prohibido de dangerouslySetInnerHTML sin comentario de excepción justificado (#69)`);
        }
      }
      if (/\.\s*(?:innerHTML|outerHTML)\s*=/.test(line)) {
        violations.push(`${rel}:${i + 1}: asignación directa a innerHTML/outerHTML prohibida (#69)`);
      }
    }
  }
  return violations;
}

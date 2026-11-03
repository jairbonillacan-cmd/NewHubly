// Chequeo de fronteras (ADR 0002, ADR 0006): ejecuta dependency-cruiser y reglas complementarias.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import {
  evaluateCruise,
  findHeroUiCssViolations,
  findHeroUiManifestViolations,
  listProjectFiles,
} from "./boundaries-report.mjs";

const roots = ["apps", "packages"].flatMap((dir) =>
  readdirSync(dir, { withFileTypes: true })
    .filter((d) => d.isDirectory() && existsSync(`${dir}/${d.name}/package.json`))
    .map((d) => `${dir}/${d.name}`),
);

const bin = "node_modules/dependency-cruiser/bin/dependency-cruiser.mjs";
const run = spawnSync(
  process.execPath,
  [bin, "apps", "packages", "--config", "packages/config/dependency-cruiser.cjs", "--output-type", "json"],
  { encoding: "utf8", maxBuffer: 64 * 1024 * 1024 },
);
if (run.error || !run.stdout) {
  console.error("No se pudo ejecutar dependency-cruiser.", run.error ?? run.stderr);
  process.exit(1);
}

const repoRoot = process.cwd();
const manifests = [
  ...(["package.json", "pnpm-lock.yaml"].filter((f) => existsSync(f)).map((f) => resolve(f))),
  ...listProjectFiles(resolve(repoRoot, "apps"), { names: ["package.json"] }),
  ...listProjectFiles(resolve(repoRoot, "packages"), { names: ["package.json"] }),
];

const cssFiles = [
  ...listProjectFiles(resolve(repoRoot, "apps"), { extensions: [".css"] }),
  ...listProjectFiles(resolve(repoRoot, "packages"), { extensions: [".css"] }),
];

const result = JSON.parse(run.stdout);
const problems = [
  ...evaluateCruise(result, roots),
  ...findHeroUiManifestViolations(manifests, { repoRoot }),
  ...findHeroUiCssViolations(cssFiles, { repoRoot }),
];
if (problems.length > 0) {
  console.error(`Fronteras: ${problems.length} problema(s)\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(`Fronteras OK: ${result.modules.length} módulos en ${roots.length} paquetes; ${manifests.length} manifiestos y ${cssFiles.length} CSS verificados.`);

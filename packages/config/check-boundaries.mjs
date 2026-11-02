// Chequeo de fronteras (ADR 0002): ejecuta dependency-cruiser y aplica evaluateCruise.
import { spawnSync } from "node:child_process";
import { existsSync, readdirSync } from "node:fs";
import { evaluateCruise } from "./boundaries-report.mjs";

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

const result = JSON.parse(run.stdout);
const problems = evaluateCruise(result, roots);
if (problems.length > 0) {
  console.error(`Fronteras: ${problems.length} problema(s)\n- ${problems.join("\n- ")}`);
  process.exit(1);
}
console.log(`Fronteras OK: ${result.modules.length} módulos en ${roots.length} paquetes.`);

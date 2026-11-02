// Reglas de lint y de fronteras (ADR 0002). dependency-cruiser es la fuente de verdad en CI;
// eslint-plugin-boundaries da el mismo aviso en el editor.
import { defineConfig } from "eslint/config";
import boundaries from "eslint-plugin-boundaries";
import tseslint from "typescript-eslint";

const element = (type) => ({ element: { type } });
const allowTo = (from, ...to) => ({
  from: element(from),
  allow: { to: { element: { types: { anyOf: to } } } },
});

export default defineConfig(
  { ignores: ["**/node_modules/**", "**/.next/**", "**/.turbo/**", "**/next-env.d.ts"] },
  tseslint.configs.recommended,
  {
    files: ["**/*.{ts,tsx}"],
    plugins: { boundaries },
    settings: {
      "import/resolver": { typescript: { noWarnOnMultipleProjects: true, project: ["apps/*/tsconfig.json", "packages/*/tsconfig.json"] } },
      "boundaries/elements": [
        { type: "web-composition", pattern: "apps/web/src/server/composition" },
        { type: "web", pattern: "apps/web" },
        { type: "domain", pattern: "packages/domain" },
        { type: "contracts", pattern: "packages/contracts" },
        { type: "application", pattern: "packages/application" },
        { type: "db", pattern: "packages/db" },
        { type: "ui", pattern: "packages/ui" },
      ],
    },
    rules: {
      "boundaries/no-unknown-files": "error",
      "boundaries/dependencies": [
        "error",
        {
          default: "disallow",
          policies: [
            { from: element("!domain"), allow: { to: { module: { origin: "external" } } } },
            { from: element("!domain"), allow: { to: { module: { origin: "core" } } } },
            allowTo("domain", "domain"),
            allowTo("contracts", "contracts", "domain"),
            allowTo("application", "application", "domain", "contracts"),
            allowTo("db", "db", "application", "domain"),
            allowTo("ui", "ui"),
            allowTo("web", "web", "application", "contracts", "ui", "web-composition"),
            allowTo("web-composition", "web-composition", "application", "contracts", "db"),
          ],
        },
      ],
    },
  },
  {
    files: ["packages/domain/**", "packages/application/**"],
    rules: {
      "no-restricted-properties": [
        "error",
        { object: "process", property: "env", message: "La configuración entra por la raíz de composición (ADR 0002)." },
      ],
    },
  },
);

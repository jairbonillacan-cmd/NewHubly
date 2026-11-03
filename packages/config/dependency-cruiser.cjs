// Matriz de dependencias del ADR 0002. Fuente de verdad del chequeo de fronteras en CI.
const PKG = "^packages/";
const onlyTo = (name, from, allowed) => ({
  name,
  severity: "error",
  comment: `${from} solo puede depender de: ${allowed.join(", ") || "nada interno"} (ADR 0002).`,
  from: { path: `^${from}/` },
  to: { path: "^(apps|packages)/", pathNot: `^(${[from, ...allowed].join("|")})/` },
});

module.exports = {
  forbidden: [
    onlyTo("domain-puro", "packages/domain", []),
    onlyTo("contracts", "packages/contracts", ["packages/domain"]),
    onlyTo("application", "packages/application", ["packages/domain", "packages/contracts"]),
    onlyTo("db", "packages/db", ["packages/application", "packages/domain"]),
    onlyTo("ui", "packages/ui", []),
    onlyTo("config", "packages/config", []),
    onlyTo("web-composicion", "apps/web/src/server/composition", ["apps/web", "packages/application", "packages/contracts", "packages/db"]),
    {
      name: "web",
      severity: "error",
      comment: "apps/web solo importa application, contracts y ui; db solo desde src/server/composition (ADR 0002).",
      from: { path: "^apps/web/", pathNot: "^apps/web/src/server/composition/" },
      to: { path: "^(apps|packages)/", pathNot: "^(apps/web|packages/(application|contracts|ui))/" },
    },
    {
      name: "domain-sin-externos",
      severity: "error",
      comment: "domain no usa librerías externas en tiempo de ejecución (ADR 0002).",
      from: { path: "^packages/domain/" },
      to: { dependencyTypes: ["npm", "npm-dev", "npm-optional", "npm-peer", "npm-no-pkg", "npm-unknown", "core"] },
    },
    {
      name: "solo-api-publica",
      severity: "error",
      comment: "Entre paquetes solo se importa el punto de entrada declarado en exports (ADR 0002).",
      from: { path: "^(apps|packages)/([^/]+)/" },
      to: { path: `${PKG}[^/]+/src/(?!(index\\.ts|tokens\\.css)$)`, pathNot: "^$1/$2/" },
    },
    {
      name: "heroui-solo-en-ui",
      severity: "error",
      comment: "@heroui/* solo puede importarse dentro de packages/ui (ADR 0006). apps/web consume exclusivamente @hubly/ui.",
      from: { pathNot: "^packages/ui/" },
      to: { path: "@heroui(/|$)" },
    },
    {
      name: "prohibido-heroui-pro",
      severity: "error",
      comment: "HeroUI Pro está estrictamente prohibido en todo el proyecto (Constitución #4, ADR 0006).",
      from: {},
      to: { path: "@heroui-pro(/|$)" },
    },
    { name: "sin-ciclos", severity: "error", from: {}, to: { circular: true } },
    { name: "sin-irresolubles", severity: "error", from: {}, to: { couldNotResolve: true } },
  ],
  options: {
    doNotFollow: { path: "node_modules" },
    // next-env.d.ts lo genera `next typegen` (typecheck/build), está en .gitignore y referencia
    // next/image-types/global, que no es resoluble; sin excluirlo daría un falso error.
    exclude: { path: ["(^|/)(node_modules|\\.next|\\.turbo)/", "(^|/)next-env\\.d\\.ts$"] },
    tsPreCompilationDeps: true,
    combinedDependencies: true,
    enhancedResolveOptions: {
      exportsFields: ["exports"],
      conditionNames: ["import", "require", "node", "default", "types"],
      extensions: [".ts", ".tsx", ".mjs", ".js", ".cjs", ".json"],
    },
  },
};

// Evalúa el resultado JSON de dependency-cruiser. Falla si hay violaciones o si algún
// paquete no fue analizado: un análisis vacío no es un verde válido.
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

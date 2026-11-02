# 0001. Monorepo con pnpm y Turborepo

Estado: Aceptado
Fecha: 2026-11-02
Issue: #1

## Contexto

La constitución pide un monolito modular con dependencias en una sola dirección, y el plan fija pnpm, Turborepo y TypeScript estricto. La Fase 0 debe quedarse en lo mínimo que exige Notas y pendientes (1A).

## Decisión

- **Herramientas.** pnpm workspaces y Turborepo. `packageManager` fijado en `package.json` raíz; `pnpm install --frozen-lockfile` en CI. Node LTS fijado en `.nvmrc` y `engines`.
- **Nombres.** Todos los paquetes se llaman `@hubly/<nombre>` y son `private: true`.
- **Paquetes de la Fase 0.** Solo los que 1A usa: `apps/web`, `packages/domain`, `packages/application`, `packages/contracts`, `packages/db`, `packages/ui` y `packages/config`. `apps/worker` y `packages/integrations` se crean cuando haya un primer caso que los necesite (Fase 2 o 3), no antes.
- **Paquetes internos sin compilar.** Cada paquete expone TypeScript fuente mediante `exports` en su `package.json`; solo `apps/web` compila (Next.js con `transpilePackages`). Nada de `dist/` interno que pueda desincronizarse.
- **API pública explícita.** Cada paquete declara en `exports` lo que se puede importar. Lo que no está en `exports` es privado (ver ADR 0002).
- **TypeScript.** Una configuración base en `packages/config` con `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` y `verbatimModuleSyntax`. Ningún paquete la relaja.
- **Tareas de Turborepo.** `lint`, `typecheck`, `test` y `build` con los mismos nombres en todos los paquetes; el CI ejecuta exactamente esas tareas.
- **Dependencias.** Versiones exactas (sin `^`), una sola versión por librería en todo el repo. Toda dependencia nueva es riesgo alto y requiere aprobación de Vega.

## Consecuencias

- Un solo `pnpm install` y un solo lockfile; el CI cachea por tarea.
- Sin paso de compilación por paquete, el esqueleto es más simple, pero cada paquete queda atado a TypeScript fuente. Si un día se publica uno, necesitará su propio build.
- Añadir `worker` o `integrations` más adelante requiere actualizar ADR 0002 y la configuración de fronteras en el mismo PR.

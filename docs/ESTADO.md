# Estado del Proyecto NewHubly — 2 de noviembre de 2026

Punto de control formal del estado del repositorio, monorepo, decisiones arquitectónicas, fases y frentes de trabajo tras el cierre operativo de la Fase 0 y la aprobación de la excepción de modelo único. Vinculado al Issue [#19](https://github.com/jairbonillacan-cmd/NewHubly/issues/19).

---

## 1. Resumen Ejecutivo de la Sesión

1. **Modelo y Gobernanza (ADR 0005, PR #18):**
   - Fusionado en `main` en commit `41640c7`.
   - Excepción del dueño operativa: Gemini 4 Argon High construye y revisa todo el producto, con una salvedad estricta: los PRs de `riesgo:alto` (auth, RLS, migraciones, pagos, tokens, webhooks, CI y dependencias nuevas) requieren además el veredicto APROBADO de un revisor de Claude lanzado por el dueño desde Claude Code.
   - Prohibido el uso de herramientas CLI (`opencode`, `codex`) y otros modelos (`DeepSeek`, `GLM`), así como Claude para construir o revisiones normales. Atlas nunca ejecuta la CLI `claude`.

2. **Fase 0 (Tokens y Contrato UX 1A, Issue #5 / PR #12):**
   - Fusionado en `main` en commit `786bc86`.
   - `packages/ui` exporta el catálogo tipado de tokens semánticos (con token `--border-control` WCAG 2.2 AA ≥ 3:1, tipografía del sistema sin dependencias externas y `color-scheme` dinámico) y `apps/web` renderiza sin valores sueltos.
   - Contrato UX de Fase 1A formalizado en `docs/diseno/notas-y-pendientes-1a.md`. Issue #5 cerrado.

3. **Fase 0 (Verificaciones Negativas, Issue #6):**
   - Pruebas empíricas en CI demostradas: PR #14 (violación de fronteras) y PR #15 (secreto falso) fallaron en rojo en GitHub Actions y fueron cerrados sin merge con ramas remotas eliminadas.
   - El despliegue de página vacía en Vercel está documentado formalmente como bloqueo externo a la espera de la vinculación de cuenta por el dueño.

---

## 2. Historial de Commits en `main`

| Commit | Mensaje | Issue / PR | Estado |
|---|---|---|---|
| `41640c7` | docs: registrar excepción de modelo único Gemini 4 Argon (#17) (#18) | #17 / PR #18 | Fusionado por el dueño tras APROBADO de Gemini y Claude (10/10 CI) |
| `786bc86` | feat: tokens semánticos base en packages/ui y contrato UX 1A (#5) (#12) | #5 / PR #12 | Fusionado por Atlas tras APROBADO de Tamiz y Prisma (11/11 CI) |
| `8c7029a` | ci: pipeline base con fronteras, secretos, CodeQL y Dependabot (#4) (#9) | #4 / PR #9 | Fusionado |
| `4618942` | feat: esqueleto del monorepo y reglas de fronteras (#3) (#7) | #3 / PR #7 | Fusionado |
| `fec4e3d` | docs: ADR de monorepo, fronteras, multi-tenancy y RLS (#1) (#2) | #1 / PR #2 | Fusionado |

---

## 3. Estado de Issues y Pull Requests

- **#5 (Tokens UI y UX 1A):** CERRADO (resuelto en PR #12).
- **#6 (Verificación Cierre Fase 0):** ABIERTO. Pruebas negativas completadas. Pendiente únicamente el despliegue de página vacía en Vercel (bloqueado por cuenta externa del dueño).
- **#17 (ADR Excepción de Modelo):** CERRADO (resuelto en PR #18).
- **#19 (Estado del proyecto y próximos pasos):** ABIERTO (creado por el dueño como punto de control).
- **#8 (Landing: Dirección editorial y bloques en packages/ui):** ABIERTO. Desbloqueado tras elección de dirección visual por el dueño (editorial con fotografía, bento y liquid glass). Asignado a Lienzo.
- **#10 (Landing: Construcción página principal):** ABIERTO (espera a #8). Asignado a Mosaico.
- **#11 (Landing: Páginas legales y secundarias):** ABIERTO (espera a #8). Asignado a Obra.
- **#16 (CI: prueba CSS en cache hit de Turbo):** ABIERTO. Corrección en `turbo.json` clasificada como `riesgo:alto`.
- **#13 (Seguimiento CI: minimatch y audit moderate):** ABIERTO (`riesgo:alto`). Asignado a Tamiz.

---

## 4. Próximos Pasos en Orden de Prioridad

1. **PR de seguimiento del ADR 0005 (Vega, docs):**
   - Actualizar estado a «Aceptado» en `docs/adr/0005-modelo-unico-gemini-argon.md` y `docs/adr/README.md`.
   - Añadir en `docs/agentes/CONFIGURACION.md` el enrutamiento de Atlas: `PRs riesgo:alto (revisión Gemini) → Vega`.
   - Actualizar descripción de la etiqueta `riesgo:alto` en GitHub.
2. **Issue #8 (Landing, dirección y bloques — Lienzo):**
   - Generar 2 o 3 variantes dentro de la dirección elegida (editorial, bento, liquid glass), con capturas a 1440px y 390px en temas claro y oscuro, para selección final del dueño.
3. **Issues #10 y #11 (Landing web y legales):** Ejecución posterior a la selección en #8.
4. **Issue #16 y #13 (Ajustes de CI, riesgo:alto):** Tratados bajo el flujo de doble revisión (Gemini + Claude lanzado por el dueño).

---

## 5. Elementos Bloqueados por el Dueño

- **Cierre formal de Fase 0 (#6):** Crear y conectar la cuenta de **Vercel** para validar el despliegue automático de la página vacía.
- **Arranque de Fase 1A (Notas y pendientes):** Crear cuenta de **Supabase** y aceptar formalmente el resumen de cierre de Fase 0.

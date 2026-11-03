# 0005. Excepción de modelo único Gemini 4 Argon y protocolo de revisión

Estado: Aceptado
Fecha: 2026-11-02
Issue: #17

## Contexto

La configuración inicial del equipo de agentes distribuía los roles entre múltiples proveedores y modelos (Claude Opus 5.5, GLM 5.3, DeepSeek V4.1 Flash vía herramientas externas como opencode-go, y Gemini 4 Argon), sustentada en la regla de `AGENTS.md`: «Quien revisa usa un proveedor distinto al que usó quien escribió».

En la práctica operativa, OpenBot falló y su licencia vence el 30 de noviembre de 2026 sin renovarse. Por su parte, el dueño del producto cuenta con una suscripción Google AI Ultra y requiere aprovechar plenamente su cuota de Gemini para la construcción y las revisiones generales. Sin embargo, en los componentes críticos donde un error puede filtrar datos (especialmente las políticas de aislamiento RLS y el flujo de autenticación de la Fase 1A, así como migraciones, pagos, tokens, webhooks, CI y dependencias nuevas clasificados como `riesgo:alto`), mantener a Claude como revisor externo evita que autor y revisor compartan los mismos puntos ciegos.

## Decisión

1. **Modelo único para construcción y revisiones generales:** Todo el equipo (Atlas como orquestador y los subagentes constructores y revisores) opera exclusivamente con **Gemini 4 Argon**, configurado con nivel de esfuerzo **High** (invocados con `Model: "inherit"`).
2. **Prohibición de herramientas externas y alcance de proveedores:** Queda prohibido el uso de herramientas CLI externas (`opencode`, `codex` u otras), así como el empleo directo o como respaldo de `DeepSeek` y `GLM` en todos los casos. Claude queda igualmente prohibido para construir código o para revisiones de riesgo normal; se autoriza única y exclusivamente como modelo de revisión para PRs clasificados como `riesgo:alto`, lanzado directamente por el dueño del producto desde Claude Code. Atlas nunca ejecuta la CLI `claude`.
3. **Suspensión condicionada de la regla de proveedor distinto:** La regla de proveedor distinto de `AGENTS.md` («Quien revisa usa un proveedor distinto al que usó quien escribió») se suspende para las tareas de desarrollo y revisiones generales, **excepto en `riesgo:alto`**, donde se mantiene estricta: autor en Gemini y revisor en Claude.
4. **Protocolo de revisión independiente para riesgo normal:** Para asegurar que la revisión técnica interna mantenga rigor e independencia bajo un mismo proveedor, se establece el siguiente protocolo:
   - **Instancia nueva:** Cada revisión de riesgo normal la ejecuta un subagente nuevo, que no haya participado en la elaboración del PR, operando en su propio clon limpio de repositorio.
   - **Aislamiento contextual:** El subagente revisor recibe únicamente el enlace del PR, el issue correspondiente y las reglas de su rol; no recibe el razonamiento ni los resúmenes del autor.
   - **Comprobación activa:** El revisor debe inspeccionar el código en su clon limpio, ejecutar los chequeos reales en su entorno (linting, tipado, pruebas y compilación) e intentar activamente identificar fallos o regresiones. No se aprueba únicamente por inspección visual del diff.
   - **Trazabilidad en comentarios:** Cada veredicto (APROBADO o CAMBIOS) se publica mediante `gh pr comment` con archivo:línea, pasos para reproducir, resultado real de comandos y la línea obligatoria:
     > `Modelo: Gemini 4 Argon. Revisión del mismo proveedor por excepción del dueño`
5. **Protocolo para PRs `riesgo:alto`:** Los PRs clasificados como `riesgo:alto` (auth, RLS, migraciones, pagos, tokens, webhooks, CI y dependencias nuevas) requieren CI en verde, la revisión técnica en Gemini y, obligatoriamente, el veredicto `APROBADO` de un revisor de Claude lanzado por el dueño. Al completarse los chequeos de CI y la revisión de Gemini, Atlas notifica al dueño con el enlace del PR para que lance la revisión de Claude; Atlas nunca ejecuta la CLI `claude`.
6. **Gobernanza:** Esta excepción fue autorizada explícitamente por el dueño del producto. Pasará a estado `Aceptado` tras la fusión del PR correspondiente.

## Consecuencias

- **Aprovechamiento de cuota y simplificación:** Se aprovecha la suscripción Google AI Ultra del dueño y se elimina la dependencia de OpenBot (cuya licencia vence el 30 de noviembre de 2026 sin renovación).
- **Prohibiciones y excepción acotada:** Siguen taxativamente prohibidos `opencode`, `codex`, `DeepSeek` y `GLM` en todos los escenarios. Claude sigue estrictamente prohibido para construir código o para revisiones de riesgo normal; se habilita únicamente para la revisión de PRs `riesgo:alto` ejecutada por el dueño.
- **Protección contra puntos ciegos en componentes críticos:** Se mantiene la revisión cruzada de proveedores distintos en los componentes donde un error compromete la seguridad o filtra datos (RLS, auth y riesgo alto en Fase 1A).
- **Condiciones de reversibilidad:** Si en el futuro el dueño del producto decide reintroducir diversidad de proveedores en otras etapas, se tramitará un nuevo ADR que reemplace este documento y actualice `AGENTS.md` y `docs/agentes/CONFIGURACION.md`.

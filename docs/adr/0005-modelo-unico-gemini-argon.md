# 0005. Excepción de modelo único Gemini 4 Argon y protocolo de revisión

Estado: Aceptado (Decisión del dueño del producto)
Fecha: 2026-11-02
Issue: #17

## Contexto

La configuración inicial del equipo de agentes distribuía los roles entre múltiples proveedores y modelos (Claude Opus 5.5, GLM 5.3, DeepSeek V4.1 Flash vía herramientas externas como opencode-go, y Gemini 4 Argon), sustentada en la regla de `AGENTS.md`: "Quien revisa usa un proveedor distinto al que usó quien escribió".

Por decisión estratégica y operativa del dueño del producto, se requiere unificar el stack de modelos en un único proveedor: **Gemini 4 Argon con esfuerzo High**. Los objetivos son garantizar homogeneidad en las capacidades del equipo, control predecible de costos de inferencia y simplificación operativa eliminando la dependencia de herramientas CLI externas y múltiples cuentas o proveedores.

## Decisión

1. **Modelo único obligatorio:** Todo el equipo (Atlas como orquestador y la totalidad de los subagentes) opera de manera exclusiva con **Gemini 4 Argon**, configurado con nivel de esfuerzo **High** (invocados con `Model: "inherit"`).
2. **Prohibición de herramientas y proveedores externos:** Queda prohibido el uso de herramientas CLI externas (`opencode`, `claude`, `codex` u otras), así como el empleo directo o como respaldo de otros modelos y proveedores (`DeepSeek`, `Claude`, `GLM`, entre otros).
3. **Suspensión de la revisión cruzada de proveedores:** Se suspende temporalmente la regla de revisión por proveedor distinto ("Quien revisa usa un proveedor distinto al que usó quien escribió") mientras permanezca vigente esta decisión del dueño del producto.
4. **Protocolo de revisión independiente bajo modelo único:** Para asegurar que la revisión mantenga rigor técnico e independencia sin sesgo de confirmación, se establece el siguiente protocolo estricto:
   - **Instancia nueva:** Cada revisión debe ser ejecutada por un subagente nuevo, que no haya participado en la elaboración del PR, operando en su propio clon limpio de repositorio.
   - **Aislamiento contextual:** El subagente revisor recibe únicamente el enlace del PR, el issue correspondiente y las reglas de su rol; no recibe el razonamiento ni los resúmenes del autor.
   - **Comprobación activa:** El revisor debe inspeccionar el código en su clon limpio, ejecutar los chequeos reales en su entorno (linting, tipado, pruebas y compilación) e intentar activamente identificar fallos o regresiones. No se aprueba únicamente por inspección visual del diff.
   - **Trazabilidad en comentarios:** Cada veredicto (APROBADO o CAMBIOS) se publica mediante `gh pr comment` con archivo:línea, pasos para reproducir, resultado real de comandos y la línea obligatoria:
     > `Modelo: Gemini 4 Argon. Revisión del mismo proveedor por excepción del dueño`
5. **Gobernanza:** Esta excepción fue autorizada explícitamente por el dueño del producto. Cualquier cambio futuro en `AGENTS.md` o en las políticas de revisión requiere su aprobación explícita previa a cualquier fusión.

## Consecuencias

- **Operativas y de costos:** Operación unificada y simplificada, sin fallos por diferencias de cuotas o incompatibilidades de herramientas CLI secundarias. Costos y consumos centralizados.
- **Prohibición estricta:** Se prohíbe taxativamente la ejecución de `opencode`, `claude`, `codex`, `DeepSeek`, `GLM` o cualquier otro proveedor secundario.
- **Calidad y verificación:** La objetividad de la revisión se preserva mediante el aislamiento contextual de subagentes en clones limpios y la exigencia de ejecución de comandos reales, mitigando el riesgo de sesgo intrínseco de proveedor único.
- **Condiciones de reversibilidad:** Si en el futuro el dueño del producto decide reintroducir diversidad de proveedores, este ADR será reemplazado por un nuevo ADR que revoque la excepción, actualice `AGENTS.md` y restaure la matriz de modelos en `docs/agentes/CONFIGURACION.md`.

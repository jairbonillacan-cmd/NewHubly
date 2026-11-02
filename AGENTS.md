# Instrucciones para agentes

Lee antes de cada tarea: [docs/CONSTITUCION.md](docs/CONSTITUCION.md) y la fase vigente en [docs/PLAN.md](docs/PLAN.md).

## Forma de trabajo

- El repo y sus issues son la fuente de verdad. El chat no lo es.
- Una rama y un PR por issue: `tipo/numero-descripcion`. Máximo unas 400 líneas. Nunca hagas push a `main`.
- Riesgo alto: auth, RLS, migraciones, pagos, tokens, webhooks, CI y dependencias nuevas. Requiere APROBADO de un revisor de Claude lanzado por el dueño.
- Quien revisa usa un proveedor distinto al que usó quien escribió. *Excepción autorizada por el dueño ([ADR 0005](docs/adr/0005-modelo-unico-gemini-argon.md)):* todo el equipo opera con Gemini 4 Argon High; la revisión independiente la realiza un subagente nuevo en un clon limpio sin el razonamiento del autor (incluyendo en el veredicto la línea: `Modelo: Gemini 4 Argon. Revisión del mismo proveedor por excepción del dueño`), salvo en `riesgo:alto`, que además requiere APROBADO de un revisor de Claude lanzado por el dueño.
- Los cambios visuales requieren además aprobación de Prisma.
- Puerto de desarrollo: `3100` o el que asigne Atlas. Nunca `3000`.
- Interfaz, documentación y commits en español. Identificadores de código en inglés.

## Reporte al terminar

```
QUÉ cambió
VERIFICADO: comandos y resultado real
NO VERIFICADO: lo que no se pudo comprobar
PR: enlace
```

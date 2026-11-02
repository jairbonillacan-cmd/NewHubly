# Instrucciones para agentes

Lee antes de cada tarea: [docs/CONSTITUCION.md](docs/CONSTITUCION.md) y la fase vigente en [docs/PLAN.md](docs/PLAN.md).

## Forma de trabajo

- El repo y sus issues son la fuente de verdad. El chat no lo es.
- Una rama y un PR por issue: `tipo/numero-descripcion`. Máximo unas 400 líneas. Nunca hagas push a `main`.
- Riesgo alto: auth, RLS, migraciones, pagos, tokens, webhooks, CI y dependencias nuevas. Requiere aprobación de Vega.
- Quien revisa usa un proveedor distinto al que usó quien escribió.
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

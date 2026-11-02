# 0002. Fronteras entre paquetes

Estado: Aceptado
Fecha: 2026-11-02
Issue: #1

## Contexto

La constitución fija la dirección `apps → application → domain`, con `db` e `integrations` implementando puertos, y exige que el CI lo haga cumplir. Hace falta una regla exacta para que el chequeo no dependa de interpretación.

## Decisión

### Matriz de dependencias permitidas

| Paquete | Puede importar de `@hubly/*` | Librerías externas permitidas |
|---|---|---|
| `domain` | nada | ninguna en tiempo de ejecución |
| `contracts` | `domain` | `zod` |
| `application` | `domain`, `contracts` | ninguna de framework ni de base de datos |
| `db` | `application`, `domain` | `drizzle-orm`, driver de Postgres, `server-only` |
| `integrations` | `application`, `domain`, `contracts` | SDK de cada proveedor, `server-only` |
| `ui` | nada | React, Radix, utilidades de estilo |
| `config` | nada | herramientas de lint y TS |
| `apps/web` | `application`, `contracts`, `ui`; `db` e `integrations` **solo** desde la raíz de composición | Next.js, React, cliente de Supabase Auth |

Todo lo que no aparece en la tabla está prohibido.

### Puertos y composición

- `application` define los puertos (repositorios, reloj, generador de IDs, proveedor de identidad) como interfaces y los casos de uso que los reciben.
- `db` e `integrations` implementan esos puertos.
- **Raíz de composición:** `apps/web/src/server/composition/`. Es la única carpeta de `apps/web` que puede importar `@hubly/db` o `@hubly/integrations`. Cada archivo empieza con `import "server-only"`. El resto de `apps/web` (páginas, componentes, server actions) obtiene casos de uso desde ahí y nunca ve un repositorio.
- `apps/web` no contiene reglas de negocio: valida la entrada con `contracts`, llama a un caso de uso y presenta el resultado.

### Reglas adicionales

1. Solo se importa por el nombre del paquete y lo declarado en `exports`; prohibido `@hubly/x/src/...` y rutas relativas que crucen paquetes.
2. Sin ciclos entre paquetes ni dentro de un paquete.
3. Un componente con `"use client"` no puede importar, ni de forma transitiva, `db`, `integrations` ni la raíz de composición.
4. `domain` y `application` no leen `process.env`; la configuración entra por la raíz de composición.

### Cómo se hace cumplir

- `dependency-cruiser` en CI es la fuente de verdad: codifica la matriz y las reglas 1, 2 y 4. Su configuración vive en `packages/config`.
- `eslint-plugin-boundaries` da el mismo aviso en el editor y en `lint`.
- La regla 3 la refuerza `server-only` en `db`, `integrations` y la raíz de composición: el build falla si llegan al cliente.
- Prueba negativa obligatoria para cerrar la Fase 0: un PR que importa `@hubly/db` desde una página de `apps/web` debe fallar el CI.

## Consecuencias

- Las pantallas solo dependen de casos de uso y contratos, así que se prueban sin base de datos.
- Hay más archivos (puerto + implementación + composición) para cada operación; es el precio de poder probar `application` y `domain` en aislamiento.
- Cambiar esta matriz requiere un ADR nuevo y el cambio de configuración en el mismo PR. Relajar una regla para que un PR pase está prohibido.

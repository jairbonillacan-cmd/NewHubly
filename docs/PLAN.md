# Plan de construcción

## Stack

| Capa | Elección |
|---|---|
| Monorepo | pnpm + Turborepo, TypeScript estricto |
| Web | Next.js 16 (App Router), React 19 |
| Datos | Postgres de Supabase, Drizzle, migraciones SQL revisadas |
| Auth, archivos, tiempo real | Supabase Auth, Storage y Realtime |
| Flujos durables | Inngest detrás de un puerto propio |
| Publicación | Adaptadores propios por red; primero Meta |
| Pagos | Stripe |
| IA | Puerto `ai`; Anthropic como primer proveedor |
| UI | Tokens propios, Tailwind 4, Radix Primitives, Storybook |
| Pruebas | Vitest, Playwright, axe, regresión visual, RLS contra Supabase local en Docker |
| Observabilidad | Sentry, OpenTelemetry, PostHog |
| Seguridad en CI | CodeQL, gitleaks, Dependabot, `pnpm audit` |

## Estructura

```
apps/web                 Rutas y composición, sin lógica de negocio
apps/worker              Funciones durables de Inngest
packages/domain          Entidades, máquinas de estado, reglas (puro)
packages/application     Casos de uso y puertos
packages/db              Esquema Drizzle, migraciones, RLS, repositorios
packages/integrations    Adaptadores: Meta, Stripe, IA, correo
packages/ui              Tokens y componentes
packages/contracts       Esquemas Zod compartidos
packages/config          TS, ESLint y reglas de fronteras
docs/adr, docs/producto, docs/diseno, docs/seguridad
```

`eslint-plugin-boundaries` y `dependency-cruiser` hacen fallar el CI si se viola la dirección de dependencias.

## Fases

Al cerrar cada fase, Atlas publica un resumen y el equipo espera la aceptación del dueño del producto.

| Fase | Entrega | Se cierra cuando |
|---|---|---|
| **0. Fundación** | Monorepo, CI, fronteras, seguridad en CI, ADRs | Un PR que viola una frontera o incluye un secreto falso falla el CI; una página vacía despliega |
| **1A. Notas y pendientes** | Login, espacio de trabajo con RLS, notas y pendientes, tokens básicos, despliegue | El dueño los usa de verdad en teléfono y laptop, y otra cuenta no puede ver sus datos en pruebas contra Postgres real |
| **1B. Lenguaje y acceso** | Dirección visual, componentes, Storybook, agencias, roles, invitaciones | Una agencia no ve datos de otra en pruebas contra Postgres real; el dueño aprueba la dirección visual |
| **2. Núcleo de contenido** | Marcas, piezas y sus estados, calendario, compositor, medios, Hoy | Una pieza va de idea a aprobada internamente, con historial |
| **3. Cliente y publicación** | Portal de aprobación, programación durable, adaptador Meta | Un post de prueba se publica en una cuenta de prueba y resiste un reintento sin duplicarse |
| **4. Resultados e IA** | Métricas reales, reportes, IA para textos, salud de cuentas | Los reportes usan solo datos reales; la IA tiene límite por agencia |
| **5. Operación** | Tareas, notificaciones, búsqueda, módulos aplazados según prioridad | Cada módulo tiene un usuario y una decisión claros, o no entra |
| **6. Lanzamiento** | Stripe, documentación legal, auditoría de seguridad y carga, observabilidad | Auditoría sin hallazgos altos abiertos y restauración de backup probada |

## Fase 0: mantenerla mínima

Incluye solo lo que Notas y pendientes requiere. Los ADR iniciales son monorepo, fronteras, multi-tenancy y RLS.

Cuando exista el CI, Atlas pide al dueño del producto que marque sus chequeos como obligatorios en `main`; los agentes no tienen permisos de administración.

## Fase 1A: Notas y pendientes

Se usa con datos reales, así que sigue todas las reglas de seguridad. Estas tablas son parte permanente del producto, no un prototipo.

- **Notas:** título, texto con formato simple, fijar, archivar y buscar. Autoguardado sin perder cambios.
- **Pendientes:** título, detalle, fecha, prioridad, hecho o no hecho. Vistas Hoy, Próximos, Sin fecha y Hechos. Captura rápida con una sola línea.
- **Relación:** crear un pendiente desde una nota, con el vínculo conservado.
- **Privacidad:** cada elemento es privado por defecto. Compartir con la agencia llega en 1B, con los roles.
- **Datos:** exportar todo a JSON y Markdown desde el primer día.
- **Uso diario:** diseño móvil completo y atajos de teclado. Sin modo sin conexión en esta entrega.
- **Después:** en la Fase 2 un pendiente podrá ligarse a una marca o pieza.
- **Comprobación:** crear una nota y un pendiente en el teléfono, verlos en la laptop, exportarlos y confirmar que una segunda cuenta no puede acceder.

Las cuentas de Supabase y Vercel las crea el dueño del producto. Los secretos van en GitHub y Vercel. Las migraciones de producción pasan por un entorno `production` de GitHub Actions que requiere su aprobación.

## Fase 1B: dirección visual

Lienzo presenta dos o tres direcciones como páginas reales. El dueño del producto elige una.

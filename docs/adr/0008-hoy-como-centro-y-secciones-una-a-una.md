# 0008. Hoy como centro de la app y construcción por secciones, una a una

Estado: Propuesto
Fecha: 2026-11-05
Issue: #103

## Contexto

Después de iniciar sesión, la persona llega a `/hoy` (#46, #54). La propuesta B (#75) convierte esa pantalla en un espacio con barra superior, carril, dock y paneles. El inventario (`docs/producto/inventario.md`) propone la navegación «Hoy, Contenido, Clientes, Aprobaciones, Resultados y Ajustes», pendiente de validar en un ADR.

El 5 de noviembre de 2026 el dueño del producto pidió nombrar ese espacio y decidió cómo crecer a partir de él:
> «Hay que hacer que ese sea el centro, y de ahí empezamos a desarrollar feature por feature, una por una hasta que esté bien armada una comenzamos con la otra y su integración con la primera feature y el core.»

Mientras tanto hay muchas líneas de trabajo abiertas a la vez (agencias, diseño del espacio, landing, login, seguridad) en cadenas de PR que dependen unas de otras. Sin una regla de orden, cada sección nueva aumenta lo que queda a medias.

## Decisión

### 1. Nombres y rutas
- **Hoy** es el centro de la app y vive en `/hoy`. Es la pantalla de llegada después de iniciar sesión. No se usa `/dashboard` ni otro nombre genérico: Hoy responde a «¿qué sigue y quién lo tiene?», que es la promesa del producto.
- **Tu espacio** es el marco común. Sus tres barras son **fijas** y solo se desplaza el contenido (#105):
  - la barra superior, con el selector de espacio de trabajo, buscar, enfoque, avisos, tema, ayuda, ajustes y el perfil;
  - el carril izquierdo, retraíble entre compacto y completo;
  - el dock inferior, cuyas opciones dependen de la sección activa.

  Todas las secciones se renderizan dentro de él.
- **Navegación:** Hoy va primero y aparte, porque es el centro. Debajo, en el carril, el grupo «Herramientas» reúne las demás secciones (Calendario, Contenido, Clientes, Anuncios, Reportes y las que vengan). Rutas en español y en minúsculas, hermanas de `/hoy` (`/calendario`, `/contenido`, `/clientes`…).
- **Secciones que todavía no existen:** se ven en el carril atenuadas, con «Pronto», y llevan a una página «Próximamente» que dice qué harán. No muestran datos inventados. Así el carril enseña hacia dónde va el producto sin prometer fechas.
- El espacio activo (personal o de agencia) se sigue resolviendo como hasta ahora (ADR 0003, cookie `hubly_ws` validada en el servidor). No entra en la URL en esta etapa.

### 2. Toda sección alimenta Hoy
- Cada sección aporta a Hoy lo que le toca hacer a la persona, con qué sigue, quién lo tiene y la fecha. Por ejemplo: «te toca revisar esta pieza», «el cliente pidió cambios» o «falló una publicación».
- Ese aporte entra por un **puerto de la capa de aplicación** (`packages/application`), no con consultas directas desde la pantalla. Así Hoy no conoce el detalle de cada sección (ADR 0002).
- Cada sección aporta también sus elementos a la búsqueda y a la paleta de comandos.
- **Cada sección entrega su configuración del dock** (`DockConfig`): contexto, acciones con su tecla, la entrada central, «Te esperan», ritmo, vistas y sugerencia. El dock es un componente único que no conoce ninguna sección (#105).

### 3. Una sección a la vez
Orden de construcción:

| # | Sección |
|---|---|
| 0 | **Núcleo:** el marco fijo de Tu espacio (#105), Hoy, búsqueda y paleta, preferencias |
| 1 | **Notas y pendientes** |
| 2 | **Equipo:** agencias, roles e invitaciones (en Ajustes y en el selector de espacio) |
| 3 | **Clientes** |
| 4 | **Contenido:** piezas, estados y parrilla |
| 5 | **Aprobaciones** del cliente |
| 6 | **Publicación** |
| 7 | **Resultados** |

Una sección está **bien armada** cuando cumple todo esto:
1. Está desplegada y el dueño la usa de verdad.
2. Tiene pruebas contra Postgres real, incluido el aislamiento por RLS.
3. Está integrada con Hoy, con la búsqueda y la paleta, con su configuración del dock y con las secciones anteriores.
4. Está revisada (con el APROBADO de Claude en `riesgo:alto`) y aprobada por el dueño.
5. El issue de cierre explica qué quedó fuera.

**No se abren issues de construcción de la siguiente sección hasta que la anterior esté bien armada.** Se permiten correcciones, seguridad y deuda técnica de las secciones ya hechas. El seguimiento vive en el issue #103.

## Consecuencias

- Se valida la navegación del inventario; la línea correspondiente apunta ahora a este ADR.
- `/hoy` no cambia de ruta. Lo que hoy cuelga de ella (notas y pendientes) pasa a ser la primera sección que alimenta Hoy, no Hoy entero.
- Las fases de `docs/PLAN.md` se mantienen; este ADR fija el orden y la definición de terminado dentro de ellas.
- El trabajo en paralelo se reduce a propósito: antes de empezar Clientes hay que cerrar las cadenas de PR abiertas y desplegar.
- Cada sección nueva implementa el puerto de aporte a Hoy y su configuración del dock desde su primer PR. Una sección que no aparece en Hoy no está terminada.
- La navegación del inventario (Contenido, Aprobaciones, Resultados) se reorganiza en las «Herramientas» del carril. Las aprobaciones viven dentro de Contenido y los resultados en Reportes.
- **Vocabulario:** «espacio» es solo el espacio de trabajo (personal o de agencia, ADR 0003). Cada sección del carril es una «herramienta». El dueño eligió «Herramientas» para que los dos conceptos no se confundan.

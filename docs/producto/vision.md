# Visión de producto y voz de Hubly

Estado: vigente desde el 6 de noviembre de 2026 (issue 131). La aprobó el dueño. Resume y ajusta al repositorio el documento «Product Vision & Brand Direction».

Este documento guía los textos públicos, la landing y las propuestas de producto. No cambia la [Constitución](../CONSTITUCION.md): «¿qué sigue y quién lo tiene?» sigue siendo la pregunta de cada pantalla, y la pieza sigue siendo la columna vertebral del contenido.

## 1. Qué es Hubly

**Hubly es un espacio de trabajo para marketing.** Reúne en un mismo lugar las ideas, los pendientes, el contenido, las marcas y el equipo.

- **Frase principal:** «Un solo espacio para todo tu marketing».
- **Categoría:** espacio de trabajo para marketing. «Marketing Workspace» solo se usa en inglés y nunca se dice «Marketing OS».
- **Para quién es:**
  - **Tu marca:** personas y negocios que llevan su propio marketing, muchas veces sin equipo.
  - **Tu agencia:** agencias y equipos que manejan varias marcas, clientes y colaboradores.
- **Un solo producto:** ambos perfiles comparten la misma base. Nadie elige un «tipo de cuenta» para empezar, y la complejidad aparece solo cuando hace falta.
- **Lo que no es:** solo un gestor de proyectos, solo un calendario editorial, solo un programador de publicaciones, un generador de contenido con IA ni una herramienta exclusiva para agencias. Esas cosas pueden ser partes de Hubly.

## 2. Qué existe hoy y qué no

Antes de escribir un texto o proponer una función, se comprueba aquí. Que exista un botón o una pantalla no significa que la función esté hecha. Esta tabla se actualiza cuando cambia una etiqueta.

| Área | Estado | Qué hay |
|---|---|---|
| Cuenta | Disponible | Registro e inicio de sesión con correo y contraseña o con enlace mágico, y confirmación por correo |
| Organizar ideas y tareas | Disponible | Hoy (vencidos, hoy, próximos, sin fecha, hechos), notas con autoguardado, pendientes creados desde una nota, captura en una línea (fecha, prioridad y nota), búsqueda, fondo propio, modo claro/oscuro, exportación y zona horaria |
| Trabajar con tu equipo | Muy pronto | Primera versión en código: crear agencia, invitar con un enlace, roles y notas compartidas. La landing la marca «Muy pronto» hasta cerrar la experiencia |
| Contenido (piezas, calendario editorial, borradores, medios) | Próximamente | Solo la página «Próximamente» del carril |
| Marcas y clientes | Próximamente | Solo la página «Próximamente» de Clientes; no existe la entidad «marca» |
| Revisión y aprobación del cliente | Próximamente | Nada construido |
| Programación y publicación en redes | Próximamente | Nada construido |
| Reportes y métricas | Próximamente | Solo la página «Próximamente» de Reportes |
| Integraciones, automatización e IA | Sin fecha | No se anuncian en la landing |
| Precios | Próximamente | `/precios` muestra los planes sin monto |

## 3. Cómo habla Hubly

Hubly habla claro, cercano y profesional, como alguien que sabe hacer marketing y te explica algo en persona.

**Reglas:**
1. **Concreto antes que abstracto.** «El copy en el chat, la parrilla en un Excel» dice más que «información dispersa».
2. **Corto.** Si un texto explica algo evidente, se quita.
3. **Sin vocabulario técnico.** El público no sabe qué es JSON, RLS, una base de datos, un token ni una paleta de comandos. Se dice qué consigue la persona: «descargas todo lo que escribiste».
4. **Honesto.** Lo que no existe lleva «Muy pronto» o «Próximamente». No se publican cifras, testimonios ni planes gratuitos inventados.
5. **Seguro, sin presumir.** Sin superlativos.

**No se usan:** «revoluciona», «lleva tu productividad al siguiente nivel», «desbloquea tu potencial», «potencia tu creatividad», «la solución definitiva», «impulsada por IA», «transforma tu flujo de trabajo», «sin precedentes», «sin fricción», «todo en un solo lugar» ni «potencia tu». La prueba `landing-blocks.test.ts` vigila parte de esta lista.

**Frases de referencia** (no hay que repetirlas en todas partes):
- «Un solo espacio para todo tu marketing».
- «Una marca o varias. Trabaja desde el mismo espacio».
- «Trabaja por tu cuenta o con tu equipo».
- «Deja de repartir tu trabajo entre tantas herramientas».

**Vocabulario:**
- **Espacio:** el espacio de trabajo de la persona o de su agencia.
- **Herramientas:** las secciones del carril (Hoy, Calendario, Contenido…).
- **Marca:** el término público para el negocio propio o el de un cliente. «Cliente» se usa cuando el contexto es claramente de agencia.
- **Pieza:** una publicación con su ciclo de vida.

## 4. La landing

Debe responder, en este orden: qué es Hubly, para qué sirve, si me sirve si trabajo solo, si me sirve en una agencia, qué puedo hacer hoy y cómo empiezo.

| Bloque | Contenido |
|---|---|
| Hero | «Un solo espacio para todo tu marketing.», una frase de apoyo, «Empezar con Hubly» (registro real) y «Ver cómo funciona» |
| Diferentes maneras de trabajar | «Para tu marca» y «Para tu agencia», sin pedir que la persona elija |
| El problema | Concreto: las herramientas desconectadas |
| Así se trabaja en Hubly | Un día real, solo con funciones disponibles |
| Tu trabajo, conectado | Agrupado por actividades, cada una con su estado |
| Crece a tu manera | De una marca a varias, sin tabla de planes |
| Lo que viene | Las etapas de la pieza, marcadas con su estado |
| Tranquilidad, preguntas y cierre | Cierre con «Tu marketing tiene su lugar.» y el registro |

## 5. Interfaz

- **Claridad, consistencia y jerarquía:** cada pantalla tiene un fin evidente, una acción principal y componentes compartidos (`@hubly/ui`, HeroUI y tokens).
- **La complejidad sigue a la necesidad:** quien lleva una sola marca no ve clientes, equipos ni permisos hasta que los pide.
- **Densidad adecuada:** las vistas deben funcionar con una marca o con muchas.
- **Accesibilidad:** contraste AA, teclado, foco visible y objetivos de 44 px.
- **Hubi** aparece cuando algo pasa (bienvenida, vacío, error, logro), no como decoración en cada tarjeta. La pose `campana` no se usa.
- **Se evitan** los gradientes sin motivo, las tarjetas de icono repetidas, los badges decorativos, el cristal donde no ayuda, las animaciones que no informan, las secciones de relleno y las métricas inventadas. Todo eso se puede usar cuando tiene un propósito concreto.

## 6. Hipótesis de arquitectura (no aprobada como cambio)

Hipótesis de crecimiento: **Espacio → Marcas → Proyectos → contenido y tareas**.

**Hoy existen:**
- espacios personales y de agencia, aislados con RLS por espacio ([ADR 0003](../adr/0003-multi-tenancy.md) y [ADR 0004](../adr/0004-rls.md));
- roles e invitaciones ([ADR 0007](../adr/0007-roles-invitaciones-y-visibilidad-agencia.md));
- notas y pendientes por espacio.

No existen las tablas de marcas ni de proyectos.

Antes de tocar modelos, permisos o autenticación hace falta un ADR que:
1. describa el estado actual;
2. señale las incompatibilidades, por ejemplo si una marca es un espacio o vive dentro de uno;
3. evalúe los riesgos de migración y de aislamiento entre clientes;
4. proponga una implementación por partes.

El aislamiento entre clientes no se sacrifica por simplificar.

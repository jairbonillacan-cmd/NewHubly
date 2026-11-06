# 0013. Rama `produccion`: integración en `main` y publicación controlada

Estado: Propuesto
Fecha: 2026-11-06
Issue: #231

## Contexto

Hasta ahora `main` cumple dos papeles. Es la rama a la que se fusionan los PR de cada issue y, por la integración de Vercel, también lo que se publica en producción. Cada PR aprobado llega a las personas usuarias en cuanto se fusiona, sin un paso para juntar varios cambios, probarlos en un entorno estable y elegir cuándo publicarlos.

Las migraciones de producción ya pasan por el entorno `production` de GitHub Actions con aprobación humana, pero salen de `main`. Así, el esquema y el código publicado pueden desincronizarse.

Se consideraron cuatro opciones:

- **`develop` + `main` (Git Flow):** obliga a cambiar la rama base por defecto, todos los workflows y las instrucciones de los agentes. Un PR abierto contra `main` por error iría directo a producción.
- **Promover despliegues a mano en Vercel:** no deja registro en git de qué se publicó ni cuándo, y depende de que alguien se acuerde de hacerlo.
- **Publicar con etiquetas de versión:** requiere un workflow propio de despliegue con tokens de Vercel. Es más superficie y más riesgo.
- **Rama `produccion`:** sin cambios en el flujo diario y con la publicación como un PR revisable. Es la que se elige.

## Decisión

1. **`main` es la rama de integración.** Los PR de cada issue se siguen abriendo contra `main`, como hoy. Lo fusionado se despliega en Vercel como entorno de pruebas, no como producción.
2. **`produccion` es la rama de producción.** Vercel publica producción solo desde ella (*Production Branch* = `produccion`).
3. **Se publica con un PR `main → produccion`.** Lo abre el dueño o un agente a petición suya y solo el dueño lo fusiona. La descripción lista los PR incluidos y las migraciones pendientes. Se fusiona con *merge commit*, sin *squash* ni *rebase*, para que el historial de ambas ramas siga alineado.
4. **Nadie hace push directo a `produccion`.** Un ruleset exige PR, los checks obligatorios en verde (`install`, `lint`, `typecheck`, `test`, `build`, `boundaries`, `audit`, `secrets` y `analyze`) y bloquea *force-push* y borrado. Solo el dueño puede fusionar. No se exige una aprobación de PR, porque GitHub no deja aprobar un PR propio y las publicaciones salen de la cuenta del dueño. Tampoco se activa «Require branches to be up to date»: con *merge commits*, `produccion` tiene commits que `main` no tiene y cada publicación aparecería desactualizada.
5. **Las migraciones de producción salen de `produccion`.** El workflow *Migraciones de Supabase en producción* solo se ejecuta sobre `refs/heads/produccion`, y el entorno `production` de GitHub limita sus despliegues a esa rama. Orden de publicación:
   1. Fusionar el PR `main → produccion`. Vercel publica el código.
   2. Lanzar el workflow sobre el head de `produccion` con **aplicar** desmarcado y revisar la simulación.
   3. Lanzarlo otra vez con **aplicar** marcado y ese mismo SHA en **sha_simulado**.
   4. Verificar el despliegue y el historial de migraciones.

   Entre los pasos 1 y 3 el código nuevo corre sobre el esquema anterior. Por eso **toda migración debe ser compatible hacia atrás** (*expand/contract*: primero se añade y después, en otra publicación, se retira). Si el código no puede funcionar sin la migración, se publica detrás de una variable de piloto vacía y se activa después de aplicarla. El workflow comprueba además que el entorno `production` tenga revisores y despliegues limitados a ramas concretas.
6. **CI y CodeQL corren en `main` y en `produccion`.**
7. **Correcciones urgentes:** por defecto, el PR va a `main` y se publica de inmediato con un PR `main → produccion`. Para que esto sea posible, `main` debe estar siempre publicable: nada a medio hacer sin su variable de piloto. Si aun así `main` tiene algo que no puede salir, el dueño autoriza una rama `fix/numero-descripcion` desde `produccion`, con su PR a `produccion` y, en el mismo día, el mismo cambio a `main` para que no diverjan.

## Consecuencias

- Los agentes no cambian su forma de trabajar: rama por issue y PR a `main`.
- El dueño decide cuándo se publica, y cada publicación queda como un PR con su lista de cambios.
- `main` puede tener trabajo aún no publicado. Las funciones a medio terminar se siguen protegiendo con las variables de piloto por espacio (`HUBLY_*_PILOT_WORKSPACE_IDS`).
- Configuración manual del dueño, fuera del repo: crear y proteger `produccion`, cambiar la *Production Branch* en Vercel y limitar el entorno `production` de GitHub a `produccion`.
- `main` pasa a desplegarse como *Preview* en Vercel. Sus variables de Preview no deben apuntar al Supabase de producción ni usar claves reales, y las URL de Preview quedan detrás de Vercel Authentication. Así el código integrado y no publicado nunca toca datos reales.
- Las ramas de integración por épica (por ejemplo, `feat/189-calendario-editorial`) siguen siendo válidas y se fusionan a `main` por PR, como cualquier otra.
- Revertir es sencillo: se vuelve a apuntar Vercel y los workflows a `main`, y se archiva `produccion`.

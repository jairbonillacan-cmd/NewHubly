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
3. **Se publica con un PR `main → produccion`.** Lo abre el dueño o un agente a petición suya y lo aprueba el dueño. La descripción lista los PR incluidos y las migraciones pendientes. Se fusiona con *merge commit*, sin *squash* ni *rebase*, para que el historial de ambas ramas siga alineado.
4. **Nadie hace push directo a `produccion`.** Queda protegida con PR obligatorio, CI en verde y aprobación del dueño.
5. **Las migraciones de producción salen de `produccion`.** El workflow *Migraciones de Supabase en producción* solo se ejecuta sobre `refs/heads/produccion`, y el entorno `production` de GitHub limita sus despliegues a esa rama. Orden de publicación: simular las migraciones, fusionar el PR, aplicar las migraciones sobre el SHA aprobado y verificar el despliegue de Vercel.
6. **CI y CodeQL corren en `main` y en `produccion`.**
7. **Correcciones urgentes:** el PR va a `main` como siempre y, una vez fusionado, se publica de inmediato con un PR `main → produccion`. No se hacen ramas que salgan de `produccion`, para que las dos ramas no diverjan.

## Consecuencias

- Los agentes no cambian su forma de trabajar: rama por issue y PR a `main`.
- El dueño decide cuándo se publica, y cada publicación queda como un PR con su lista de cambios.
- `main` puede tener trabajo aún no publicado. Las funciones a medio terminar se siguen protegiendo con las variables de piloto por espacio (`HUBLY_*_PILOT_WORKSPACE_IDS`).
- Configuración manual del dueño, fuera del repo: crear y proteger `produccion`, cambiar la *Production Branch* en Vercel y limitar el entorno `production` de GitHub a `produccion`.
- Las ramas de integración por épica (por ejemplo, `feat/189-calendario-editorial`) siguen siendo válidas y se fusionan a `main` por PR, como cualquier otra.
- Revertir es sencillo: se vuelve a apuntar Vercel y los workflows a `main`, y se archiva `produccion`.

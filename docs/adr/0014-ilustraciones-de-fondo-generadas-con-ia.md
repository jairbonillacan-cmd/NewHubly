# 0014. Ilustraciones de fondo generadas con IA

Estado: Aceptado
Fecha: 2026-11-07
Issue: #250

## Contexto

Con #238 (PR #243, todavía sin fusionar al escribir este ADR) Hubly incorpora 12 ilustraciones de fondo en `apps/web/public/fondos`, cada una con una versión estática, una miniatura y una animada. La revisión de Prisma preguntó de dónde salían, porque la [Constitución](../CONSTITUCION.md) pide en Producto #4 que «producto, textos, diseño y assets» sean originales y que no se copie ni se imite a ningún competidor.

El dueño confirmó que las ilustraciones están **generadas con IA**: son originales en el sentido de que no se copiaron de ningún producto ni banco de imágenes, pero no las dibujó una persona. Las seis animaciones que faltaban se hicieron después a partir de la imagen estática, con un movimiento de cámara en bucle.

## Decisión

1. **Se aceptan los assets generados con IA** como originales a efectos de Producto #4 si cumplen las tres condiciones siguientes:
   - no se pidió imitar a un competidor, a un artista concreto ni una obra o personaje reconocible;
   - no contienen marcas, logotipos, texto ni personas identificables;
   - la herramienta que los generó permite el uso comercial del resultado.
2. **Cada asset generado con IA queda registrado** en [`docs/diseno/procedencia-de-assets.md`](../diseno/procedencia-de-assets.md): nombre, que es generado con IA, la herramienta y la fecha. Las 12 ilustraciones actuales entran con la herramienta «pendiente de confirmar por el dueño» (ver Consecuencias).
3. **La mascota Hubi, el logotipo y la identidad de marca no se generan con IA.** Siguen siendo diseño propio: son lo que distingue a Hubly y lo que se querría proteger.
4. **En la interfaz no se presentan como obra de un autor.** No se publican créditos de artista ni se afirma que sean ilustraciones hechas a mano (Honestidad).

## Consecuencias

- Las ilustraciones pueden quedarse en el producto y en la serie #243–#247 sin cambiar la Constitución.
- **Falta por confirmar:** qué herramienta se usó y si sus términos permiten el uso comercial. Hasta que el dueño lo indique en ese registro, este punto queda abierto en #250. Si los términos no lo permiten, las ilustraciones afectadas se retiran del selector.
- En varias jurisdicciones, una imagen generada con IA sin aportación humana suficiente puede no tener derechos de autor. Hubly no puede impedir que otros reutilicen estas ilustraciones, así que no deben formar parte de la identidad de marca. Por eso existe el punto 3.
- Cualquier asset nuevo generado con IA sigue el mismo registro y las mismas condiciones.

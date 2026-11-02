# Constitución de Hubly

Si una decisión choca con este documento, se detiene y se escala. Solo el dueño del producto puede cambiarlo.

## Producto

1. **La pregunta central.** Cada pantalla responde "¿qué sigue y quién lo tiene?".
2. **La pieza es la columna vertebral.** Su ciclo es `idea → borrador → revisión interna → aprobación del cliente → programada → publicada → medida`. Cada transición queda auditada.
3. **Nada se simula.** Una función existe de verdad o no aparece. No hay modo demo con datos falsos ni botones sin efecto.
4. **Identidad propia.** Producto, textos, diseño y assets son originales. No se copia ni se imita a ningún competidor, y no se usa material obtenido por ingeniería inversa de otros productos.
5. **Los datos son del cliente.** Siempre se pueden exportar.

## Ingeniería

1. **Monolito modular.** Las dependencias van en una sola dirección: `apps → application → domain`. `db` e `integrations` implementan puertos. El CI lo hace cumplir.
2. **Dominio puro.** Estados y reglas de negocio sin framework ni base de datos.
3. **Multi-tenant desde la primera tabla.** Toda tabla de negocio tiene RLS y pruebas contra Postgres real que demuestran el aislamiento.
4. **Decisiones escritas.** Cada decisión relevante tiene un ADR breve en `docs/adr`.
5. **Sin prueba no está hecho.** Cada cambio de comportamiento lleva prueba. Una prueba inestable se arregla; no se desactiva.
6. **Diseño por tokens.** Se prohíben colores y medidas sueltas. Móvil, modo oscuro, teclado y WCAG 2.2 AA son requisitos desde el primer día.
7. **Los chequeos no se debilitan** para que algo pase.

## Seguridad

- El repo es público: ningún secreto entra en el repo, el chat ni los logs.
- Los agentes no reciben claves de producción ni usan datos reales de clientes.
- La autorización se valida en cada caso de uso, además de RLS.
- Se valida con Zod en cada frontera.
- CSP con nonce y cabeceras estrictas.
- Tokens de portal hasheados y con caducidad; tokens OAuth cifrados.
- Webhooks con firma verificada. Rate limiting y bitácora inmutable.
- `service_role` solo en el worker. Archivos con URLs firmadas.
- Las migraciones de producción requieren aprobación humana.

## Honestidad

"Listo" significa ejecutado y comprobado. Se reporta el resultado real y también lo que no se pudo verificar.

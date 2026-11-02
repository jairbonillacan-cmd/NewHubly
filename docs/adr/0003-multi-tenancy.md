# 0003. Multi-tenancy por espacio de trabajo

Estado: Aceptado
Fecha: 2026-11-02
Issue: #1

## Contexto

La constitución exige multi-tenancy desde la primera tabla. En 1A cada persona usa notas y pendientes privados; en 1B llegan agencias, roles e invitaciones. Si 1A se modela solo por usuario, 1B obliga a migrar datos reales.

## Decisión

- **Unidad de aislamiento:** el espacio de trabajo, tabla `workspaces`. En 1B una agencia es un espacio de trabajo; no se crea otra entidad de tenant.
- **Membresía:** `workspace_members (workspace_id, user_id, role)`, con clave primaria compuesta. Rol inicial: `owner`. Los demás roles llegan en 1B con su propio ADR.
- **Alta en 1A:** al registrarse, una persona recibe un espacio de trabajo propio con ella como `owner`, en la misma transacción.
- **Toda tabla de negocio** lleva `workspace_id uuid not null` con FK a `workspaces` e índice que empiece por `workspace_id`.
- **Referencias dentro del tenant:** las FK entre tablas de negocio son compuestas, `(workspace_id, x_id) → x(workspace_id, id)`, para que la base impida, por ejemplo, ligar un pendiente a una nota de otro espacio de trabajo. Cada tabla referenciable tiene `unique (workspace_id, id)`.
- **Privacidad en 1A:** además de `workspace_id`, cada nota y pendiente tiene `created_by uuid not null` y es visible solo para su autor. Compartir con el espacio de trabajo llega en 1B como una columna de visibilidad con valor por defecto privado, mediante migración aditiva.
- **Origen del tenant:** el `workspace_id` activo nunca se acepta del cliente sin comprobarlo. El servidor lo resuelve desde la sesión verificada y la membresía; un caso de uso que reciba un `workspace_id` comprueba la membresía antes de actuar (autorización en cada caso de uso, además de RLS, según la constitución).
- **IDs:** `uuid` generados por la base (`gen_random_uuid()`), nunca secuencias expuestas.
- **Exportación:** se exporta por espacio de trabajo y autor, con el mismo filtro que la lectura.

## Consecuencias

- 1B añade roles, invitaciones y visibilidad sin mover datos existentes.
- Cada consulta y cada índice cargan `workspace_id`; es redundante en 1A, pero barato.
- Las FK compuestas convierten un error de aislamiento en un error de integridad visible, no en una fuga silenciosa.

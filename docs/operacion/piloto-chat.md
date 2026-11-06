# Activación del piloto de chat

## Antes de abrir acceso

1. Validar Equipo con dos cuentas sintéticas en una agencia de prueba. Comprobar que se pueden unir y que sus notas privadas permanecen separadas.
2. Obtener la revisión independiente, la aprobación de Prisma sobre claro, oscuro y móvil y la de Claude lanzado por el dueño para cada PR de riesgo alto. Fusionar la cadena de abajo hacia arriba y comprobar el CI de `main`.
3. El dueño crea el entorno `production` en GitHub, configura un revisor obligatorio, limita los despliegues a `main` y deshabilita la opción de omitir sus reglas. Guarda allí `PRODUCTION_MIGRATION_DATABASE_URL` con la conexión de migraciones de Supabase. [Protecciones de entornos en GitHub](https://docs.github.com/en/actions/reference/workflows-and-actions/deployments-and-environments)

## Aplicación y verificación

1. Lanzar **Migraciones de Supabase en producción** desde `main` con **aplicar** desmarcado. Tras la aprobación humana, comprobar que la simulación enumera las versiones de chat `20261110000000`, `20261111000000` y `20261112000000` que aún falten. [Migraciones de Supabase](https://supabase.com/docs/guides/deployment/database-migrations)
2. Repetir sobre el mismo SHA con **aplicar** marcado, el SHA completo en **sha_simulado** y aprobación humana. Confirmar que las tres versiones aparecen en la columna remota del historial.
3. Configurar en Vercel `HUBLY_CHAT_PILOT_WORKSPACE_IDS` con los UUID de las agencias autorizadas separados por comas. Es una variable de servidor. Desplegar `main` y empezar con una sola agencia de prueba.
4. Verificar desde laptop y teléfono que ambas cuentas pueden enviar en canal y directo, volver a Hoy, recuperar mensajes tras desconectar y ver el mismo estado de lectura. Medir desde un envío confirmado hasta su aparición en la otra sesión con la pestaña visible. El objetivo es menos de cinco segundos en condiciones normales.
5. Registrar la prueba del piloto en #153. Usar tiempos y códigos de error agregados en los reportes, sin texto de mensajes ni identificadores de cuentas.

## Desactivación

Vaciar `HUBLY_CHAT_PILOT_WORKSPACE_IDS` o retirar la agencia afectada y volver a desplegar. La ruta, las entradas de navegación y el API dejan de dar acceso. Las tablas y su historial permanecen en Postgres. Antes de reactivar, repetir las pruebas de acceso y reintento en la agencia de prueba.

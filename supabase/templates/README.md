# Correos de Auth

Plantillas en español de los correos que envía Supabase Auth. En local las carga `supabase/config.toml`; en producción se pegan a mano en el panel de Supabase: **Authentication → Emails → Templates**.

| Panel de Supabase | Asunto | Archivo |
|---|---|---|
| Confirm sign up | Confirma tu cuenta de Hubly | `confirmacion.html` |
| Magic link or OTP | Tu enlace para entrar a Hubly | `enlace-magico.html` |
| Invite user | Te invitaron a Hubly | `invitacion.html` |
| Change email address | Confirma tu nuevo correo de Hubly | `cambio-correo.html` |
| Reauthentication | Tu código de verificación de Hubly | `reautenticacion.html` |
| Reset password | *(sin cambios)* | Todavía no hay pantalla para elegir una contraseña nueva. |

Los enlaces apuntan a `/auth/confirm?token_hash=…&type=…`. La app valida el token en el servidor, así que el enlace funciona aunque se abra en otro navegador o dispositivo. La confirmación de registro añade `&flujo=registro` para abrir Hoy con la bienvenida.

Si se cambia una plantilla aquí, hay que volver a pegarla en el panel de producción.

## Hubi en los correos (issue 125)
Cada plantilla muestra un Hubi de 96 px servido desde `{{ .SiteURL }}/marca/correo/`. Si cambias el dominio de producción, actualiza el **Site URL** de Supabase para que las imágenes sigan cargando. Al pegar las plantillas en Supabase, copia el archivo completo.

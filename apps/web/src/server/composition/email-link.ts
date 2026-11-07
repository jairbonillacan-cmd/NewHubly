import "server-only";
import { signUpWithPasswordSchema } from "@hubly/contracts";

/**
 * Enlaces que llegan por correo (registro, enlace mágico, invitación y cambio de correo).
 * La recuperación de contraseña queda fuera hasta que exista la pantalla para elegir una nueva.
 */
export const EMAIL_LINK_TYPES = ["email", "signup", "magiclink", "invite", "email_change"] as const;
export type EmailLinkType = (typeof EMAIL_LINK_TYPES)[number];
export const isEmailLinkType = (value: string | null): value is EmailLinkType =>
  value !== null && (EMAIL_LINK_TYPES as readonly string[]).includes(value);

/** Ruta a la que apuntan las plantillas de supabase/templates; la prueba de plantillas comprueba que la usan. */
export const EMAIL_CONFIRM_PATH = "/auth/confirm";

/** Solo «registro» cambia el destino: nunca se acepta una ruta libre en la URL, para no abrir una redirección. */
export const SIGNUP_FLOW = "registro";
export const destinationAfterEmailLink = (flow: string | null): string => flow === SIGNUP_FLOW ? "/inicio?bienvenida=1" : "/inicio";

/** Errores que /login sabe explicar; cualquier otro valor se ignora. */
export const EMAIL_LINK_ERRORS = { invalid: "enlace-invalido", expired: "enlace-caducado" } as const;

/**
 * El nombre del espacio elegido al registrarse viaja en los metadatos de la cuenta, porque la confirmación llega
 * en otra petición (a veces en otro dispositivo). La persona puede editar sus metadatos, así que se valida igual
 * que en el formulario y, si no es válido, se usa el nombre por defecto.
 */
export function workspaceNameFromMetadata(metadata: unknown): string | undefined {
  const raw = (metadata as { workspace_name?: unknown } | null | undefined)?.workspace_name;
  const parsed = signUpWithPasswordSchema.shape.workspaceName.safeParse(raw);
  return parsed.success ? parsed.data : undefined;
}

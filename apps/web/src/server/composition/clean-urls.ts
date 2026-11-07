/** Herramientas del carril con ruta propia (#212). Debe coincidir con HERRAMIENTAS de @hubly/ui; lo comprueba una prueba. */
export const TOOL_PATHS = ["/hub", "/calendario", "/contenido", "/clientes", "/anuncios", "/reportes"] as const;
const LEGACY_PARAMS = ["modo", "herramienta", "vista", "workspaceId"] as const;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const isWorkspacePath = (path: string): boolean =>
  (TOOL_PATHS as readonly string[]).includes(path) || path === "/chat" || path === "/chat/sin-leer";
export const isAuthPath = (path: string): boolean => path === "/login" || path === "/registro";

/**
 * Enlaces viejos con datos en la URL (#212) → su URL limpia. El espacio de ?workspaceId pasa a la cookie «hubly_ws»;
 * la pertenencia se comprueba en el servidor en cada petición (ensureAuthenticatedWorkspace) y, si no es miembro, se usa
 * otro espacio suyo: la cookie solo elige entre los espacios propios. Devuelve null si la URL ya está limpia.
 */
export function cleanLegacyUrl(url: URL): { target: URL; workspaceId: string | null } | null {
  const params = url.searchParams;
  if (!LEGACY_PARAMS.some((key) => params.has(key))) return null;
  const target = new URL(url);
  if (url.pathname === "/login" && params.get("modo") === "registro") target.pathname = "/registro";
  const tool = params.get("herramienta");
  if (url.pathname === "/hub" && tool && (TOOL_PATHS as readonly string[]).includes(`/${tool}`)) target.pathname = `/${tool}`;
  if (url.pathname === "/chat" && params.get("vista") === "sin-leer") target.pathname = "/chat/sin-leer";
  for (const key of LEGACY_PARAMS) target.searchParams.delete(key);
  const rawWorkspace = isWorkspacePath(url.pathname) ? params.get("workspaceId") : null;
  return { target, workspaceId: rawWorkspace && UUID.test(rawWorkspace) ? rawWorkspace.toLowerCase() : null };
}

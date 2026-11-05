import type { CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { buildContentSecurityPolicy, createNonce, staticSecurityHeaders } from "./security-headers";
import { createSupabaseServerClient, enforceHttpOnlyCookieOptions } from "./server/composition/auth";

// /invitacion lee la sesión en el servidor: hay que refrescarla aquí, porque un componente de servidor no puede escribir cookies.
const needsSession = (path: string) =>
  path.startsWith("/hoy") || path.startsWith("/login") || path.startsWith("/auth") || path.startsWith("/invitacion");

/** Añade la CSP con nonce y las cabeceras fijas a cualquier respuesta, también a las redirecciones (#91). */
function withSecurityHeaders(response: NextResponse, csp: string, path: string): NextResponse {
  response.headers.set("Content-Security-Policy", csp);
  for (const [name, value] of Object.entries(staticSecurityHeaders(process.env.NODE_ENV === "production"))) response.headers.set(name, value);
  // El enlace de invitación lleva el token en el fragmento: en esa página no se envía Referer a nadie (#64).
  if (path.startsWith("/invitacion")) response.headers.set("Referrer-Policy", "no-referrer");
  return response;
}

export async function updateSession(request: NextRequest) {
  const nonce = createNonce();
  const csp = buildContentSecurityPolicy({ nonce, isDev: process.env.NODE_ENV === "development", supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL });
  // Next lee el nonce de la CSP de la petición y lo pone en sus propios scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", csp);
  const next = () => NextResponse.next({ request: { headers: requestHeaders } });

  const path = request.nextUrl.pathname;
  if (!needsSession(path)) return withSecurityHeaders(next(), csp, path);

  let response = next();
  const supabase = await createSupabaseServerClient({
    getAll: () => request.cookies.getAll(),
    setAll: (cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) => {
      for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
      requestHeaders.set("cookie", request.cookies.toString());
      response = next();
      for (const { name, value, options } of cookiesToSet) {
        response.cookies.set(name, value, enforceHttpOnlyCookieOptions(options));
      }
    },
  });
  const { data, error } = await supabase.auth.getUser();
  // Una Server Action (POST con cabecera «next-action») no se redirige aquí: el cliente recibiría el HTML de /login como
  // respuesta inesperada. Se deja pasar y la propia acción redirige a /login con una respuesta que Next entiende (#92).
  const isServerAction = request.method === "POST" && request.headers.has("next-action");
  if (path.startsWith("/hoy") && !isServerAction && (error || !data?.user?.id)) {
    return withSecurityHeaders(NextResponse.redirect(new URL("/login", request.url)), csp, path);
  }
  return withSecurityHeaders(response, csp, path);
}

export function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

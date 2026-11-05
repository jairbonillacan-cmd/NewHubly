import type { CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { buildContentSecurityPolicy, createNonce, staticSecurityHeaders } from "./security-headers";
import { createSupabaseServerClient, enforceHttpOnlyCookieOptions } from "./server/composition/auth";

const needsSession = (path: string) => path.startsWith("/hoy") || path.startsWith("/login") || path.startsWith("/auth");

/** Añade la CSP con nonce y las cabeceras fijas a cualquier respuesta, también a las redirecciones (#91). */
function withSecurityHeaders(response: NextResponse, csp: string): NextResponse {
  response.headers.set("Content-Security-Policy", csp);
  for (const [name, value] of Object.entries(staticSecurityHeaders(process.env.NODE_ENV === "production"))) response.headers.set(name, value);
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
  if (!needsSession(path)) return withSecurityHeaders(next(), csp);

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
  if (path.startsWith("/hoy") && (error || !data?.user?.id)) {
    return withSecurityHeaders(NextResponse.redirect(new URL("/login", request.url)), csp);
  }
  return withSecurityHeaders(response, csp);
}

export function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

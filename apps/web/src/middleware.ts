import type { CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, enforceHttpOnlyCookieOptions, HUBLY_WORKSPACE_COOKIE } from "./server/composition/auth";
import { cleanLegacyUrl, isAuthPath, isWorkspacePath } from "./server/composition/clean-urls";

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  // /invitacion lee la sesión en el servidor: hay que refrescarla aquí, porque un componente de servidor no puede escribir cookies.
  if (!isWorkspacePath(path) && !isAuthPath(path) && !path.startsWith("/auth") && !path.startsWith("/invitacion")) {
    return NextResponse.next({ request });
  }
  let response = NextResponse.next({ request });
  const supabase = await createSupabaseServerClient({
    getAll: () => request.cookies.getAll(),
    setAll: (cookiesToSet: Array<{ name: string; value: string; options?: CookieOptions }>) => {
      for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
      response = NextResponse.next({ request });
      for (const { name, value, options } of cookiesToSet) {
        response.cookies.set(name, value, enforceHttpOnlyCookieOptions(options));
      }
    },
  });
  const { data, error } = await supabase.auth.getUser();
  const signedIn = !error && Boolean(data?.user?.id);
  // Una redirección debe llevarse las cookies renovadas por getUser(): si se perdieran, el refresh token ya rotado
  // dejaría la sesión inservible.
  const redirectTo = (target: URL) => {
    const redirect = NextResponse.redirect(target);
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  };
  // Una Server Action (POST con cabecera «next-action») no se redirige aquí: el cliente recibiría el HTML de /login como
  // respuesta inesperada. Se deja pasar y la propia acción redirige a /login con una respuesta que Next entiende (#92).
  const isServerAction = request.method === "POST" && request.headers.has("next-action");
  if (isServerAction) return response;
  if (isWorkspacePath(path) && !signedIn) return redirectTo(new URL("/login", request.url));
  // Con sesión válida, /login y /registro (p. ej. «Entrar» desde la landing) llevan directo a Hoy (#198).
  if (isAuthPath(path) && signedIn) return redirectTo(new URL("/hoy", request.url));
  const clean = cleanLegacyUrl(request.nextUrl);
  if (clean) {
    const redirect = redirectTo(clean.target);
    if (clean.workspaceId) redirect.cookies.set(HUBLY_WORKSPACE_COOKIE, clean.workspaceId, enforceHttpOnlyCookieOptions({ maxAge: 60 * 60 * 24 * 30 }));
    return redirect;
  }
  return response;
}

export function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

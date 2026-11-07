import type { CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, enforceHttpOnlyCookieOptions } from "./server/composition/auth";

export async function updateSession(request: NextRequest) {
  const path = request.nextUrl.pathname;
  // /invitacion lee la sesión en el servidor: hay que refrescarla aquí, porque un componente de servidor no puede escribir cookies.
  if (!path.startsWith("/hoy") && path !== "/chat" && !path.startsWith("/login") && !path.startsWith("/auth") && !path.startsWith("/invitacion")) {
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
  // Una Server Action (POST con cabecera «next-action») no se redirige aquí: el cliente recibiría el HTML de /login como
  // respuesta inesperada. Se deja pasar y la propia acción redirige a /login con una respuesta que Next entiende (#92).
  const isServerAction = request.method === "POST" && request.headers.has("next-action");
  if ((path.startsWith("/hoy") || path === "/chat") && !isServerAction && (error || !data?.user?.id)) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  return response;
}

export function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};

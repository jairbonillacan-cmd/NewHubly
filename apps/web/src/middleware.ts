import type { CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient, enforceHttpOnlyCookieOptions } from "./server/composition";

export async function updateSession(request: NextRequest) {
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
  if (request.nextUrl.pathname.startsWith("/hoy") && (error || !data?.user?.id)) {
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

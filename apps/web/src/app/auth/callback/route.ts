import { NextResponse } from "next/server";
import { createSupabaseServerClient, ensureAuthenticatedWorkspace } from "../../../server/composition";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/login?error=codigo-faltante", url.origin));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/login?error=sesion-invalida", url.origin));
  await ensureAuthenticatedWorkspace();
  return NextResponse.redirect(new URL("/hoy", url.origin));
}

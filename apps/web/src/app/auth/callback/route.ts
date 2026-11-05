import { NextResponse } from "next/server";
import { EMAIL_LINK_ERRORS, completeEmailLinkSignIn, createSupabaseServerClient } from "../../../server/composition";

/** Código PKCE: solo sirve en el navegador donde se pidió. Los correos usan /auth/confirm; esta ruta queda de respaldo. */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL(`/login?error=${EMAIL_LINK_ERRORS.invalid}`, url.origin));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL(`/login?error=${EMAIL_LINK_ERRORS.expired}`, url.origin));
  return NextResponse.redirect(new URL(await completeEmailLinkSignIn(supabase, url.searchParams.get("flujo")), url.origin));
}

import { NextResponse } from "next/server";
import { EMAIL_LINK_ERRORS, completeEmailLinkSignIn, createSupabaseServerClient, isEmailLinkType } from "../../../server/composition";

/**
 * Enlaces de los correos de Supabase (plantillas en supabase/templates). Se valida el token del correo en el
 * servidor, así que el enlace funciona aunque se abra en otro navegador o dispositivo, a diferencia del código
 * PKCE de /auth/callback, que necesita la cookie del navegador donde se pidió.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");
  if (!tokenHash || !isEmailLinkType(type)) return NextResponse.redirect(new URL(`/login?error=${EMAIL_LINK_ERRORS.invalid}`, url.origin));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
  if (error) return NextResponse.redirect(new URL(`/login?error=${EMAIL_LINK_ERRORS.expired}`, url.origin));
  return NextResponse.redirect(new URL(await completeEmailLinkSignIn(supabase, url.searchParams.get("flujo")), url.origin));
}

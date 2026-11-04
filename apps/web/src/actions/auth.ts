"use server";
import {
  signInWithMagicLinkSchema, signInWithPasswordSchema, signUpWithPasswordSchema,
  type SignInWithMagicLinkInput, type SignInWithPasswordInput, type SignUpWithPasswordInput,
} from "@hubly/contracts";
import { createSupabaseServerClient, ensureAuthenticatedWorkspace, resolveSiteUrl } from "../server/composition";

const GENERIC_AUTH_ERROR = "No se pudo iniciar sesión";
export const GENERIC_MAGIC_LINK_MESSAGE = "Si el correo es válido, te enviamos un mensaje";

export async function signInWithPasswordAction(input: SignInWithPasswordInput): Promise<{ ok: true; workspaceId: string; userId: string }> {
  const parsed = signInWithPasswordSchema.parse(input);
  const { data, error } = await (await createSupabaseServerClient()).auth.signInWithPassword({ email: parsed.email, password: parsed.password });
  if (error || !data?.user?.id) throw new Error(GENERIC_AUTH_ERROR);
  const ctx = await ensureAuthenticatedWorkspace();
  return { ok: true, workspaceId: ctx.workspaceId, userId: ctx.userId };
}

export async function signUpWithPasswordAction(input: SignUpWithPasswordInput): Promise<{ ok: true; workspaceId: string | null; requiresEmailConfirmation: boolean }> {
  const parsed = signUpWithPasswordSchema.parse(input);
  const { data, error } = await (await createSupabaseServerClient()).auth.signUp({ email: parsed.email, password: parsed.password });
  if (error || !data?.user?.id) throw new Error(GENERIC_AUTH_ERROR);
  if (!data.session) return { ok: true, workspaceId: null, requiresEmailConfirmation: true };
  const ctx = await ensureAuthenticatedWorkspace(undefined, parsed.workspaceName);
  return { ok: true, workspaceId: ctx.workspaceId, requiresEmailConfirmation: false };
}

export async function signInWithMagicLinkAction(input: SignInWithMagicLinkInput): Promise<{ ok: true; message: string }> {
  const parsed = signInWithMagicLinkSchema.parse(input);
  const emailRedirectTo = `${resolveSiteUrl()}/auth/callback`;
  await (await createSupabaseServerClient()).auth.signInWithOtp({ email: parsed.email, options: { emailRedirectTo } });
  return { ok: true, message: GENERIC_MAGIC_LINK_MESSAGE };
}

export async function signOutAction(): Promise<{ ok: true }> {
  await (await createSupabaseServerClient()).auth.signOut();
  return { ok: true };
}

"use server";
import {
  signInWithMagicLinkSchema, signInWithPasswordSchema, signUpWithPasswordSchema,
  type SignInWithMagicLinkInput, type SignInWithPasswordInput, type SignUpWithPasswordInput,
} from "@hubly/contracts";
import { GENERIC_AUTH_ERROR, GENERIC_MAGIC_LINK_MESSAGE, createSupabaseServerClient, ensureAuthenticatedWorkspace, resolveSiteUrl } from "../server/composition";

/**
 * Los fallos esperados se devuelven, no se lanzan: en producción Next.js no deja pasar al cliente el mensaje de un
 * error lanzado por una Server Action, y la persona vería un texto técnico en inglés (#92).
 */
export type AuthFailure = { ok: false; message: string };
const failure = (message: string): AuthFailure => ({ ok: false, message });
const firstIssue = (issues: ReadonlyArray<{ message: string }>) => issues[0]?.message ?? GENERIC_AUTH_ERROR;

export async function signInWithPasswordAction(input: SignInWithPasswordInput): Promise<{ ok: true; workspaceId: string; userId: string } | AuthFailure> {
  const parsed = signInWithPasswordSchema.safeParse(input);
  if (!parsed.success) return failure(firstIssue(parsed.error.issues));
  const { data, error } = await (await createSupabaseServerClient()).auth.signInWithPassword({ email: parsed.data.email, password: parsed.data.password });
  if (error || !data?.user?.id) return failure(GENERIC_AUTH_ERROR);
  const ctx = await ensureAuthenticatedWorkspace();
  return { ok: true, workspaceId: ctx.workspaceId, userId: ctx.userId };
}

export async function signUpWithPasswordAction(input: SignUpWithPasswordInput): Promise<{ ok: true; workspaceId: string | null; requiresEmailConfirmation: boolean } | AuthFailure> {
  const parsed = signUpWithPasswordSchema.safeParse(input);
  if (!parsed.success) return failure(firstIssue(parsed.error.issues));
  const { data, error } = await (await createSupabaseServerClient()).auth.signUp({ email: parsed.data.email, password: parsed.data.password });
  if (error || !data?.user?.id) return failure(GENERIC_AUTH_ERROR);
  if (!data.session) return { ok: true, workspaceId: null, requiresEmailConfirmation: true };
  const ctx = await ensureAuthenticatedWorkspace(undefined, parsed.data.workspaceName);
  return { ok: true, workspaceId: ctx.workspaceId, requiresEmailConfirmation: false };
}

export async function signInWithMagicLinkAction(input: SignInWithMagicLinkInput): Promise<{ ok: true; message: string } | AuthFailure> {
  const parsed = signInWithMagicLinkSchema.safeParse(input);
  if (!parsed.success) return failure(firstIssue(parsed.error.issues));
  const emailRedirectTo = `${resolveSiteUrl()}/auth/callback`;
  await (await createSupabaseServerClient()).auth.signInWithOtp({ email: parsed.data.email, options: { emailRedirectTo } });
  return { ok: true, message: GENERIC_MAGIC_LINK_MESSAGE };
}

export async function signOutAction(): Promise<{ ok: true }> {
  await (await createSupabaseServerClient()).auth.signOut();
  return { ok: true };
}

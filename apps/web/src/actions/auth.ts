"use server";
import {
  signInWithMagicLinkSchema, signInWithPasswordSchema, signUpWithPasswordSchema,
  type SignInWithMagicLinkInput, type SignInWithPasswordInput, type SignUpWithPasswordInput,
} from "@hubly/contracts";
import { createSupabaseServerClient, ensureAuthenticatedWorkspace } from "../server/composition";

export async function signInWithPasswordAction(input: SignInWithPasswordInput): Promise<{ ok: true; workspaceId: string; userId: string }> {
  const parsed = signInWithPasswordSchema.parse(input);
  const { data, error } = await (await createSupabaseServerClient()).auth.signInWithPassword({ email: parsed.email, password: parsed.password });
  if (error || !data?.user?.id) throw new Error(error?.message || "Credenciales inválidas");
  const ctx = await ensureAuthenticatedWorkspace();
  return { ok: true, workspaceId: ctx.workspaceId, userId: ctx.userId };
}

export async function signUpWithPasswordAction(input: SignUpWithPasswordInput): Promise<{ ok: true; workspaceId: string | null; requiresEmailConfirmation: boolean }> {
  const parsed = signUpWithPasswordSchema.parse(input);
  const { data, error } = await (await createSupabaseServerClient()).auth.signUp({ email: parsed.email, password: parsed.password });
  if (error || !data?.user?.id) throw new Error(error?.message || "No se pudo crear la cuenta");
  if (!data.session) return { ok: true, workspaceId: null, requiresEmailConfirmation: true };
  const ctx = await ensureAuthenticatedWorkspace(undefined, parsed.workspaceName);
  return { ok: true, workspaceId: ctx.workspaceId, requiresEmailConfirmation: false };
}

export async function signInWithMagicLinkAction(input: SignInWithMagicLinkInput): Promise<{ ok: true }> {
  const parsed = signInWithMagicLinkSchema.parse(input);
  const { error } = await (await createSupabaseServerClient()).auth.signInWithOtp({ email: parsed.email });
  if (error) throw new Error(error.message);
  return { ok: true };
}

export async function signOutAction(): Promise<{ ok: true }> {
  await (await createSupabaseServerClient()).auth.signOut();
  return { ok: true };
}

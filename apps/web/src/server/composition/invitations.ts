import "server-only";
import { createHash, randomBytes } from "node:crypto";
import { acceptInvitationInputSchema, inviteMemberInputSchema, revokeInvitationInputSchema } from "@hubly/contracts";
import { DrizzleWorkspaceRepository, withUserContext, type UserClaims, type WorkspaceInvitationRecord, type WorkspaceKind, type WorkspaceRole } from "@hubly/db";
import { getVerifiedServerSession, persistActiveWorkspaceCookie } from "./auth";

export interface InvitationContext {
  claims: UserClaims; workspaceId: string; workspaceKind: WorkspaceKind; role: WorkspaceRole; db?: Parameters<typeof withUserContext>[2];
}

export async function issueWorkspaceInvitation(
  ctx: InvitationContext,
  input: { email: string; role: "admin" | "editor" | "viewer"; expiresAt?: Date | string },
): Promise<{ invitation: WorkspaceInvitationRecord; invitationPath: string }> {
  const parsed = inviteMemberInputSchema.parse({ workspaceId: ctx.workspaceId, email: input.email, role: input.role });
  if (ctx.workspaceKind !== "agency") throw new Error("Solo se permiten invitaciones en espacios de tipo agencia");
  if (ctx.role !== "owner" && ctx.role !== "admin") throw new Error("Solo propietarios y administradores pueden gestionar invitaciones");
  if (ctx.role === "admin" && parsed.role === "admin") throw new Error("Solo un propietario puede invitar o revocar administradores");
  const wsRepo = new DrizzleWorkspaceRepository(ctx.claims, ctx.db), email = parsed.email.trim().toLowerCase();
  if ((await wsRepo.listPendingInvitations(ctx.workspaceId)).some((inv) => inv.email.trim().toLowerCase() === email)) {
    throw new Error("Ya existe una invitación pendiente activa para este correo");
  }
  const rawToken = randomBytes(32).toString("base64url");
  const token_hash = createHash("sha256").update(rawToken, "utf8").digest("hex");
  const invitation = await wsRepo.createInvitationWithTokenHash({ workspaceId: ctx.workspaceId, email, role: parsed.role, tokenHash: token_hash, ...(input.expiresAt !== undefined ? { expiresAt: input.expiresAt } : {}) });
  return { invitation, invitationPath: `/invitacion#${rawToken}` };
}

export async function revokePendingWorkspaceInvitation(ctx: InvitationContext, invitationId: string): Promise<void> {
  const parsed = revokeInvitationInputSchema.parse({ workspaceId: ctx.workspaceId, invitationId });
  if (ctx.workspaceKind !== "agency" || (ctx.role !== "owner" && ctx.role !== "admin")) throw new Error("Solo propietarios y administradores pueden gestionar invitaciones");
  await new DrizzleWorkspaceRepository(ctx.claims, ctx.db).revokeInvitation(ctx.workspaceId, parsed.invitationId);
}

export async function acceptWorkspaceInvitationByToken(rawInputToken: string, db?: InvitationContext["db"]): Promise<{ workspaceId: string }> {
  const cleaned = rawInputToken.includes("#") ? rawInputToken.slice(rawInputToken.lastIndexOf("#") + 1) : rawInputToken;
  const { rawToken } = acceptInvitationInputSchema.parse({ rawToken: cleaned });
  const { claims } = await getVerifiedServerSession();
  const workspaceId = await new DrizzleWorkspaceRepository(claims, db).acceptInvitation(rawToken);
  await persistActiveWorkspaceCookie(workspaceId);
  return { workspaceId };
}

export type AcceptInvitationErrorCode = "SIN_SESION" | "CORREO_NO_COINCIDE" | "YA_MIEMBRO" | "INVALIDA" | "ERROR";
export type AcceptInvitationResult = { ok: true; workspaceId: string } | { ok: false; code: AcceptInvitationErrorCode; message: string };

const ACCEPT_MESSAGES: Record<AcceptInvitationErrorCode, string> = {
  SIN_SESION: "Inicia sesión con el correo al que llegó la invitación y vuelve a abrir el enlace.",
  CORREO_NO_COINCIDE: "Tu cuenta no coincide con el correo de la invitación. Inicia sesión con ese correo y vuelve a abrir el enlace.",
  YA_MIEMBRO: "Ya formas parte de esta agencia.",
  INVALIDA: "La invitación no es válida, ya se usó, se revocó o venció. Pide un enlace nuevo a quien administra la agencia.",
  ERROR: "No se pudo aceptar la invitación. Inténtalo de nuevo en unos minutos.",
};

/** Traduce el fallo a un código estable: en producción Next.js no deja pasar el mensaje de un error lanzado al cliente. */
export function classifyInvitationError(err: unknown): AcceptInvitationErrorCode {
  const e = err as { code?: unknown; message?: unknown; name?: unknown } | null;
  const message = typeof e?.message === "string" ? e.message : "";
  if (message.includes("Sesión caducada") || message.includes("Usuario no autenticado")) return "SIN_SESION";
  if (e?.name === "ZodError") return "INVALIDA";
  switch (e?.code) {
    case "23505": return "YA_MIEMBRO";
    case "22023": return "INVALIDA";
    case "42501": return message.includes("correo") ? "CORREO_NO_COINCIDE" : "SIN_SESION";
    default: return "ERROR";
  }
}

export async function acceptWorkspaceInvitationSafely(rawInputToken: string, db?: InvitationContext["db"]): Promise<AcceptInvitationResult> {
  try {
    return { ok: true, ...(await acceptWorkspaceInvitationByToken(rawInputToken, db)) };
  } catch (err) {
    const code = classifyInvitationError(err);
    if (code === "ERROR") console.error("Fallo inesperado al aceptar una invitación", err);
    return { ok: false, code, message: ACCEPT_MESSAGES[code] };
  }
}

/** Correo de la sesión actual, o null si no hay sesión válida. Para que /invitacion avise antes de intentar aceptar. */
export async function currentSessionEmail(): Promise<string | null> {
  try { return (await getVerifiedServerSession()).email ?? ""; } catch { return null; }
}

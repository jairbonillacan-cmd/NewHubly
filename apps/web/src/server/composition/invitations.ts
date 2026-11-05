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

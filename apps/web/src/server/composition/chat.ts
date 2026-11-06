import "server-only";
import { ChatAccessError, createChatService } from "@hubly/application";
import { DrizzleChatRepository, DrizzleWorkspaceRepository, type UserClaims, type UserWorkspaceSummary, type withUserContext } from "@hubly/db";
import { getVerifiedServerSession } from "./auth";

type DbInstance = Parameters<typeof withUserContext>[2];

export function isChatEnabled(workspaceId: string, allowlist = process.env.HUBLY_CHAT_PILOT_WORKSPACE_IDS): boolean {
  const id = workspaceId.trim().toLowerCase();
  return Boolean(id) && (allowlist ?? "").split(",").some((entry) => entry.trim().toLowerCase() === id);
}

export function composeChatService(workspace: UserWorkspaceSummary, claims: UserClaims, db?: DbInstance) {
  return createChatService({
    workspaceId: workspace.id, userId: claims.sub, workspaceKind: workspace.kind, role: workspace.role,
    enabled: isChatEnabled(workspace.id),
  }, new DrizzleChatRepository(claims, workspace.id, db));
}

export async function getChatService(workspaceId: string) {
  const { claims } = await getVerifiedServerSession();
  if (!isChatEnabled(workspaceId)) throw new ChatAccessError();
  const repo = new DrizzleWorkspaceRepository(claims);
  const workspace = (await repo.listUserWorkspaces()).find((item) => item.id === workspaceId);
  if (!workspace || workspace.kind !== "agency") throw new ChatAccessError();
  return composeChatService(workspace, claims);
}

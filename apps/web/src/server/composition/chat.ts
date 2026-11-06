import "server-only";
import { ChatAccessError, createChatService } from "@hubly/application";
import { DrizzleChatRepository, DrizzleWorkspaceRepository } from "@hubly/db";
import { getVerifiedServerSession } from "./auth";

export function isChatEnabled(workspaceId: string, allowlist = process.env.HUBLY_CHAT_PILOT_WORKSPACE_IDS): boolean {
  return Boolean(workspaceId) && (allowlist ?? "").split(",").some((entry) => entry.trim().toLowerCase() === workspaceId);
}

export async function getChatService(workspaceId: string) {
  const { claims } = await getVerifiedServerSession();
  if (!isChatEnabled(workspaceId)) throw new ChatAccessError();
  const repo = new DrizzleWorkspaceRepository(claims);
  const workspace = (await repo.listUserWorkspaces()).find((item) => item.id === workspaceId);
  if (!workspace || workspace.kind !== "agency") throw new ChatAccessError();
  return createChatService({
    workspaceId, userId: claims.sub, workspaceKind: workspace.kind, role: workspace.role, enabled: true,
  }, new DrizzleChatRepository(claims, workspaceId));
}

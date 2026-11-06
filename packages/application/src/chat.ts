import type { ChatCommand, ChatCommandResult, ChatConversation, ChatHistory, ChatMessage, ChatSync } from "@hubly/contracts";
import type { WorkspaceRole } from "@hubly/domain";

export type { ChatCommand, ChatCommandResult, ChatConversation, ChatHistory, ChatMessage, ChatSync } from "@hubly/contracts";

export interface ChatContext {
  workspaceId: string;
  userId: string;
  role: WorkspaceRole;
  workspaceKind: "agency" | "personal";
  enabled: boolean;
}

export interface ChatRepository {
  conversations(): Promise<ChatConversation[]>;
  conversation(id: string): Promise<ChatConversation | null>;
  canContact(userId: string): Promise<boolean>;
  ownsMessage(conversationId: string, messageId: string): Promise<boolean>;
  history(id: string, before?: number): Promise<ChatHistory | null>;
  sync(id: string | undefined, after: number): Promise<ChatSync>;
  ensureGeneral(): Promise<string>;
  command(input: ChatCommand): Promise<ChatCommandResult>;
  ownMessages(): Promise<ChatMessage[]>;
}

export class ChatAccessError extends Error {
  constructor() {
    super("Chat o conversación no disponible.");
  }
}

export function createChatService(ctx: ChatContext, repo: ChatRepository) {
  function requireAgency(workspaceId: string) {
    if (!ctx.enabled || ctx.workspaceKind !== "agency" || ctx.workspaceId !== workspaceId) {
      throw new ChatAccessError();
    }
  }

  return {
    async list(workspaceId: string) {
      requireAgency(workspaceId);
      return await repo.conversations();
    },
    async bootstrap(workspaceId: string) {
      requireAgency(workspaceId);
      return await repo.ensureGeneral();
    },
    async history(workspaceId: string, id: string, before?: number) {
      requireAgency(workspaceId);
      const page = await repo.history(id, before);
      if (!page) throw new ChatAccessError();
      return page;
    },
    async sync(workspaceId: string, id: string | undefined, after: number) {
      requireAgency(workspaceId);
      return await repo.sync(id, after);
    },
    async command(input: ChatCommand) {
      requireAgency(input.workspaceId);
      if (ctx.role === "viewer" && input.kind !== "read") throw new ChatAccessError();
      if (input.kind === "createChannel" || input.kind === "renameChannel" || input.kind === "archiveChannel") {
        if (ctx.role !== "owner" && ctx.role !== "admin") throw new ChatAccessError();
      }
      if (input.kind === "openDirect" && (input.recipientId === ctx.userId || !await repo.canContact(input.recipientId))) {
        throw new ChatAccessError();
      }
      if ("conversationId" in input) {
        const conversation = await repo.conversation(input.conversationId);
        if (!conversation || (input.kind !== "read" && !conversation.writable)) throw new ChatAccessError();
        if ((input.kind === "renameChannel" || input.kind === "archiveChannel")
            && (conversation.kind !== "channel" || conversation.slug === "general")) throw new ChatAccessError();
      }
      if ((input.kind === "edit" || input.kind === "remove")
          && !await repo.ownsMessage(input.conversationId, input.messageId)) throw new ChatAccessError();
      return await repo.command(input);
    },
    async exportOwn(workspaceId: string) {
      requireAgency(workspaceId);
      return await repo.ownMessages();
    },
  };
}

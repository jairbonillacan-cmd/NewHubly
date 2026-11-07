import { chatCommandSchema, chatHistorySchema, chatSyncSchema } from "@hubly/contracts";
import type { ChatCommand, ChatCommandResult, ChatConversation, ChatHistory, ChatMessage, ChatParticipant, ChatSync } from "@hubly/contracts";
import type { WorkspaceRole } from "@hubly/domain";

export type { ChatCommand, ChatCommandResult, ChatConversation, ChatHistory, ChatMessage, ChatParticipant, ChatSync } from "@hubly/contracts";

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
  directory(): Promise<ChatParticipant[]>;
}

export class ChatAccessError extends Error {
  constructor() {
    super("Chat o conversación no disponible.");
  }
}

export type ChatFailure = "conflict" | "rate-limit" | "invalid";

/** Error de una solicitud de chat bien formada que rechaza una regla de negocio. */
export class ChatRequestError extends Error {
  constructor(readonly reason: ChatFailure) {
    super(reason === "conflict" ? "Ya existe un canal con ese nombre."
      : reason === "rate-limit" ? "Vas demasiado rápido. Espera un momento y vuelve a intentarlo." : "La solicitud de chat no es válida.");
  }
}

const sqlFailures: Record<string, ChatFailure> = { "23505": "conflict", P0429: "rate-limit", "22023": "invalid", "23514": "invalid" };

/** Traduce los códigos de Postgres a errores de aplicación; lo desconocido sigue como fallo interno. */
function translate(error: unknown): never {
  const failure = error as { code?: unknown; cause?: { code?: unknown } } | null;
  const code = String(failure?.cause?.code ?? failure?.code ?? "");
  if (code === "42501") throw new ChatAccessError();
  const reason = sqlFailures[code];
  throw reason ? new ChatRequestError(reason) : error;
}

const guarded = <T>(run: () => Promise<T>) => run().catch(translate);

export function createChatService(ctx: ChatContext, repo: ChatRepository) {
  function requireAgency(workspaceId: string) {
    if (!ctx.enabled || ctx.workspaceKind !== "agency" || ctx.workspaceId.toLowerCase() !== workspaceId.toLowerCase()) {
      throw new ChatAccessError();
    }
  }

  return {
    async list(workspaceId: string) {
      requireAgency(workspaceId);
      return await guarded(() => repo.conversations());
    },
    async bootstrap(workspaceId: string) {
      requireAgency(workspaceId);
      return await guarded(() => repo.ensureGeneral());
    },
    async history(workspaceId: string, id: string, before?: number) {
      requireAgency(workspaceId);
      const input = chatHistorySchema.safeParse({ workspaceId, conversationId: id, before });
      if (!input.success) throw new ChatRequestError("invalid");
      const page = await guarded(() => repo.history(input.data.conversationId, input.data.before));
      if (!page) throw new ChatAccessError();
      return page;
    },
    async sync(workspaceId: string, id: string | undefined, after: number) {
      requireAgency(workspaceId);
      const input = chatSyncSchema.safeParse({ workspaceId, conversationId: id, after });
      if (!input.success) throw new ChatRequestError("invalid");
      return await guarded(() => repo.sync(input.data.conversationId, input.data.after));
    },
    async command(raw: ChatCommand) {
      // También se valida aquí: el servicio no depende de que cada adaptador aplique antes el contrato.
      const parsed = chatCommandSchema.safeParse(raw);
      if (!parsed.success) throw new ChatRequestError("invalid");
      const input = parsed.data;
      requireAgency(input.workspaceId);
      if (ctx.role === "viewer" && input.kind !== "read") throw new ChatAccessError();
      if (input.kind === "createChannel" || input.kind === "renameChannel" || input.kind === "archiveChannel") {
        if (ctx.role !== "owner" && ctx.role !== "admin") throw new ChatAccessError();
      }
      if (input.kind === "openDirect" && (input.recipientId === ctx.userId || !await guarded(() => repo.canContact(input.recipientId)))) {
        throw new ChatAccessError();
      }
      if ("conversationId" in input) {
        const conversation = await guarded(() => repo.conversation(input.conversationId));
        if (!conversation || (input.kind !== "read" && !conversation.writable)) throw new ChatAccessError();
        if ((input.kind === "renameChannel" || input.kind === "archiveChannel")
            && (conversation.kind !== "channel" || conversation.slug === "general")) throw new ChatAccessError();
      }
      if ((input.kind === "edit" || input.kind === "remove")
          && !await guarded(() => repo.ownsMessage(input.conversationId, input.messageId))) throw new ChatAccessError();
      return await guarded(() => repo.command(input));
    },
    async directory(workspaceId: string) {
      requireAgency(workspaceId);
      return await guarded(() => repo.directory());
    },
    async exportOwn(workspaceId: string) {
      requireAgency(workspaceId);
      return await guarded(() => repo.ownMessages());
    },
  };
}

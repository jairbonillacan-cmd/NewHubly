import "server-only";
import { sql } from "drizzle-orm";
import type { ChatCommand, ChatCommandResult, ChatConversation, ChatMessage, ChatRepository } from "@hubly/application";
import { withUserContext, type DbTransaction, type UserClaims } from "../context";

type DbInstance = Parameters<typeof withUserContext>[2];

type MessageRow = Omit<ChatMessage, "sentAt" | "editedAt" | "deletedAt"> & {
  sentAt: Date | string;
  editedAt: Date | string | null;
  deletedAt: Date | string | null;
};

const messageColumns = sql`id, conversation_id as "conversationId", author_id as "authorId", body,
  message_number as number, change_number as change, created_at as "sentAt",
  edited_at as "editedAt", deleted_at as "deletedAt"`;
const pageSize = 50;

function message(row: MessageRow): ChatMessage {
  return {
    ...row,
    sentAt: new Date(row.sentAt).toISOString(),
    editedAt: row.editedAt ? new Date(row.editedAt).toISOString() : null,
    deletedAt: row.deletedAt ? new Date(row.deletedAt).toISOString() : null,
  };
}

export class DrizzleChatRepository implements ChatRepository {
  constructor(private readonly claims: UserClaims, private readonly workspaceId: string, private readonly db?: DbInstance) {}

  private scoped<T>(run: (tx: DbTransaction) => Promise<T>) {
    return withUserContext(this.claims, run, this.db);
  }

  private async summaries(tx: DbTransaction, id?: string): Promise<ChatConversation[]> {
    const workspaceId = this.workspaceId;
    const userId = this.claims.sub;
    return [...await tx.execute<ChatConversation>(sql`
      select c.id, c.kind, c.slug, pm_id.id as "peerId",
        c.archived_at is not null as archived,
        coalesce(c.archived_at is null
          and private.chat_agency_role(c.workspace_id) in ('owner', 'admin', 'editor')
          and (c.kind = 'channel' or pm.role in ('owner', 'admin', 'editor')), false) as writable,
        exists (select 1 from private.chat_messages m where m.workspace_id = c.workspace_id and m.conversation_id = c.id
          and m.author_id <> ${userId}::uuid and m.deleted_at is null
          and m.message_number > coalesce(r.message_number, 0)) as unread,
        c.last_change_number as "changeCursor"
      from private.chat_conversations c
      cross join lateral (select case when c.member_low = ${userId}::uuid then c.member_high else c.member_low end as id) pm_id
      left join public.workspace_members pm on pm.workspace_id = c.workspace_id and pm.user_id = pm_id.id
      left join private.chat_reads r on r.workspace_id = c.workspace_id and r.conversation_id = c.id and r.user_id = ${userId}::uuid
      where c.workspace_id = ${workspaceId}::uuid ${id ? sql`and c.id = ${id}::uuid` : sql``}
      order by c.archived_at is not null, c.slug is distinct from 'general', c.slug, c.created_at desc, c.id
    `)];
  }

  conversations() {
    return this.scoped((tx) => this.summaries(tx));
  }

  conversation(id: string) {
    return this.scoped(async (tx) => (await this.summaries(tx, id))[0] ?? null);
  }

  canContact(userId: string) {
    return this.scoped(async (tx) => (await tx.execute(sql`
      select 1 from public.workspace_members where workspace_id = ${this.workspaceId}::uuid
        and user_id = ${userId}::uuid and role in ('owner', 'admin', 'editor')
    `)).length === 1);
  }

  ownsMessage(conversationId: string, messageId: string) {
    return this.scoped(async (tx) => (await tx.execute(sql`
      select 1 from private.chat_messages where workspace_id = ${this.workspaceId}::uuid
        and conversation_id = ${conversationId}::uuid and id = ${messageId}::uuid
        and author_id = ${this.claims.sub}::uuid and deleted_at is null
    `)).length === 1);
  }

  history(id: string, before?: number) {
    return this.scoped(async (tx) => {
      const [conversation] = await this.summaries(tx, id);
      if (!conversation) return null;
      const rows = await tx.execute<MessageRow>(sql`
        select ${messageColumns} from private.chat_messages
        where workspace_id = ${this.workspaceId}::uuid and conversation_id = ${id}::uuid
          ${before === undefined ? sql`` : sql`and message_number < ${before}`}
        order by message_number desc limit ${pageSize + 1}
      `);
      const messages = rows.slice(0, pageSize).reverse().map(message);
      return { conversation, messages, before: rows.length > pageSize ? (messages[0]?.number ?? null) : null };
    });
  }

  sync(id: string | undefined, after: number) {
    return this.scoped(async (tx) => {
      const conversations = await this.summaries(tx);
      if (!id || !conversations.some((entry) => entry.id === id)) {
        return { conversations, conversationAvailable: !id, changes: [], after, hasMore: false };
      }
      const rows = await tx.execute<MessageRow>(sql`
        select ${messageColumns} from private.chat_messages
        where workspace_id = ${this.workspaceId}::uuid and conversation_id = ${id}::uuid and change_number > ${after}
        order by change_number limit ${pageSize + 1}
      `);
      const changes = rows.slice(0, pageSize).map(message);
      return { conversations, conversationAvailable: true, changes, after: changes.at(-1)?.change ?? after, hasMore: rows.length > pageSize };
    });
  }

  ensureGeneral() {
    return this.scoped(async (tx) => (await tx.execute<{ id: string }>(
      sql`select private.chat_ensure_general(${this.workspaceId}::uuid) as id`,
    ))[0]!.id);
  }

  command(input: ChatCommand): Promise<ChatCommandResult> {
    return this.scoped(async (tx) => {
      const workspaceId = this.workspaceId;
      switch (input.kind) {
        case "openDirect": {
          const [row] = await tx.execute<{ id: string }>(sql`
            select private.chat_open_direct(${workspaceId}::uuid, ${input.recipientId}::uuid) as id`);
          return { conversationId: row!.id };
        }
        case "createChannel":
        case "renameChannel":
        case "archiveChannel": {
          const id = input.kind === "createChannel" ? null : input.conversationId;
          const slug = input.kind === "archiveChannel" ? null : input.slug;
          const [row] = await tx.execute<{ id: string }>(sql`
            select private.chat_manage_channel(${workspaceId}::uuid, ${id}::uuid, ${slug}, ${input.kind === "archiveChannel"}) as id`);
          return { conversationId: row!.id };
        }
        case "send": {
          const [result] = await tx.execute<{ id: string }>(sql`
            select private.chat_send_message(${workspaceId}::uuid, ${input.conversationId}::uuid, ${input.retryKey}::uuid, ${input.body}) as id`);
          const [row] = await tx.execute<MessageRow>(sql`
            select ${messageColumns} from private.chat_messages where workspace_id = ${workspaceId}::uuid
              and conversation_id = ${input.conversationId}::uuid and id = ${result!.id}::uuid`);
          return { conversationId: input.conversationId, message: message(row!) };
        }
        case "edit":
        case "remove": {
          await tx.execute(sql`select private.chat_change_message(${workspaceId}::uuid, ${input.conversationId}::uuid,
            ${input.messageId}::uuid, ${input.kind === "edit" ? input.body : null})`);
          return { conversationId: input.conversationId };
        }
        case "read": {
          const [row] = await tx.execute<{ through: number }>(sql`
            select private.chat_mark_read(${workspaceId}::uuid, ${input.conversationId}::uuid, ${input.through}::integer) as through`);
          return { conversationId: input.conversationId, through: row!.through };
        }
      }
    });
  }

  ownMessages() {
    return this.scoped(async (tx) => (await tx.execute<MessageRow>(sql`
      select ${messageColumns} from private.chat_messages
      where workspace_id = ${this.workspaceId}::uuid and author_id = ${this.claims.sub}::uuid and deleted_at is null
      order by created_at, conversation_id, message_number
    `)).map(message));
  }
}

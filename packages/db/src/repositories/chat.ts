import "server-only";
import { sql } from "drizzle-orm";
import type { ChatCommand, ChatCommandResult, ChatConversation, ChatMessage, ChatParticipant, ChatRepository } from "@hubly/application";
import { withUserContext, type DbTransaction, type UserClaims } from "../context";

type DbInstance = Parameters<typeof withUserContext>[2];

type MessageRow = Omit<ChatMessage, "sentAt" | "editedAt" | "deletedAt" | "threadLastReplyAt"> & {
  sentAt: Date | string;
  editedAt: Date | string | null;
  deletedAt: Date | string | null;
  threadLastReplyAt?: Date | string | null;
};

const messageColumns = sql`id, conversation_id as "conversationId", author_id as "authorId", body,
  message_number as number, change_number as change, created_at as "sentAt",
  edited_at as "editedAt", deleted_at as "deletedAt"`;
// Cita, hilo, reacciones agregadas por emoji (en orden de primera reacción) y adjuntos registrados. Requiere el alias `m`.
const socialColumns = sql`, m.reply_to_id as "replyToId", m.thread_root_id as "threadRootId",
  m.thread_reply_count as "threadReplyCount", m.thread_last_reply_at as "threadLastReplyAt",
  coalesce((select json_agg(json_build_object('emoji', g.emoji, 'count', g.total, 'userIds', g.user_ids) order by g.first_at, g.emoji)
    from (select r.emoji, count(*)::integer as total, array_agg(r.user_id order by r.created_at, r.user_id) as user_ids,
        min(r.created_at) as first_at
      from private.chat_reactions r
      where r.workspace_id = m.workspace_id and r.conversation_id = m.conversation_id and r.message_id = m.id
      group by r.emoji) g), '[]'::json) as reactions,
  coalesce((select json_agg(json_build_object('id', a.id, 'fileName', a.file_name, 'mimeType', a.mime_type,
        'byteSize', a.byte_size, 'width', a.width, 'height', a.height) order by a.created_at, a.id)
    from private.chat_attachments a
    where a.workspace_id = m.workspace_id and a.conversation_id = m.conversation_id and a.message_id = m.id), '[]'::json) as attachments`;
const pageSize = 50;
const mentionLimit = 100;

const iso = (value: Date | string) => new Date(value).toISOString();

function message(row: MessageRow): ChatMessage {
  const { threadLastReplyAt, ...rest } = row;
  return {
    ...rest,
    sentAt: iso(row.sentAt),
    editedAt: row.editedAt ? iso(row.editedAt) : null,
    deletedAt: row.deletedAt ? iso(row.deletedAt) : null,
    ...(threadLastReplyAt === undefined ? {} : { threadLastReplyAt: threadLastReplyAt ? iso(threadLastReplyAt) : null }),
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
          and m.author_id <> ${userId}::uuid and m.deleted_at is null and m.thread_root_id is null
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

  history(id: string, before?: number, threadRootId?: string) {
    return this.scoped(async (tx) => {
      const [conversation] = await this.summaries(tx, id);
      if (!conversation) return null;
      // La conversación principal no incluye respuestas de hilo; con `threadRootId`, solo las de ese hilo.
      const rows = await tx.execute<MessageRow>(sql`
        select ${messageColumns}${socialColumns} from private.chat_messages m
        where workspace_id = ${this.workspaceId}::uuid and conversation_id = ${id}::uuid
          and ${threadRootId ? sql`thread_root_id = ${threadRootId}::uuid` : sql`thread_root_id is null`}
          ${before === undefined ? sql`` : sql`and message_number < ${before}`}
        order by message_number desc limit ${pageSize + 1}
      `);
      const messages = rows.slice(0, pageSize).reverse().map(message);
      return { conversation, messages, before: rows.length > pageSize ? (messages[0]?.number ?? null) : null };
    });
  }

  private async unreadMentions(tx: DbTransaction) {
    const rows = await tx.execute<{ messageId: string; conversationId: string; createdAt: Date | string }>(sql`
      select n.message_id as "messageId", n.conversation_id as "conversationId", n.created_at as "createdAt"
      from private.chat_mentions n
      join private.chat_messages m on m.workspace_id = n.workspace_id and m.conversation_id = n.conversation_id
        and m.id = n.message_id and m.deleted_at is null
      where n.workspace_id = ${this.workspaceId}::uuid and n.mentioned_user_id = ${this.claims.sub}::uuid and n.read_at is null
      order by n.created_at, n.message_id limit ${mentionLimit}
    `);
    return [...rows].map((row) => ({ ...row, createdAt: iso(row.createdAt) }));
  }

  sync(id: string | undefined, after: number) {
    return this.scoped(async (tx) => {
      const conversations = await this.summaries(tx);
      const unreadMentions = await this.unreadMentions(tx);
      if (!id || !conversations.some((entry) => entry.id === id)) {
        return { conversations, conversationAvailable: !id, changes: [], after, hasMore: false, reactions: {}, typingUserIds: [], unreadMentions };
      }
      const rows = await tx.execute<MessageRow>(sql`
        select ${messageColumns}${socialColumns} from private.chat_messages m
        where workspace_id = ${this.workspaceId}::uuid and conversation_id = ${id}::uuid and change_number > ${after}
        order by change_number limit ${pageSize + 1}
      `);
      const changes: ChatMessage[] = rows.slice(0, pageSize).map(message);
      const typing = await tx.execute<{ userId: string }>(sql`
        select user_id as "userId" from private.chat_typing
        where workspace_id = ${this.workspaceId}::uuid and conversation_id = ${id}::uuid
          and user_id <> ${this.claims.sub}::uuid and expires_at > clock_timestamp()
        order by updated_at, user_id
      `);
      return {
        conversations, conversationAvailable: true, changes, after: changes.at(-1)?.change ?? after, hasMore: rows.length > pageSize,
        reactions: Object.fromEntries(changes.map((entry) => [entry.id, entry.reactions ?? []])),
        typingUserIds: [...typing].map((row) => row.userId),
        unreadMentions,
      };
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
          // Los UUID ya vienen validados por el contrato; el literal de arreglo de Postgres es seguro.
          const mentioned = `{${[...new Set(input.mentionedUserIds ?? [])].join(",")}}`;
          const [result] = await tx.execute<{ id: string }>(sql`
            select private.chat_send_message(${workspaceId}::uuid, ${input.conversationId}::uuid, ${input.retryKey}::uuid, ${input.body},
              ${input.replyToId ?? null}::uuid, ${input.threadRootId ?? null}::uuid, ${mentioned}::uuid[]) as id`);
          const [row] = await tx.execute<MessageRow>(sql`
            select ${messageColumns}${socialColumns} from private.chat_messages m where workspace_id = ${workspaceId}::uuid
              and conversation_id = ${input.conversationId}::uuid and id = ${result!.id}::uuid`);
          return { conversationId: input.conversationId, message: message(row!) };
        }
        case "toggleReaction": {
          const [row] = await tx.execute<{ added: boolean }>(sql`
            select private.chat_toggle_reaction(${workspaceId}::uuid, ${input.conversationId}::uuid,
              ${input.messageId}::uuid, ${input.emoji}) as added`);
          return { conversationId: input.conversationId, added: row!.added };
        }
        case "typing": {
          const [row] = await tx.execute<{ expiresAt: Date | string }>(sql`
            select private.chat_set_typing(${workspaceId}::uuid, ${input.conversationId}::uuid) as "expiresAt"`);
          return { conversationId: input.conversationId, expiresAt: iso(row!.expiresAt) };
        }
        case "markMentionsRead": {
          const [row] = await tx.execute<{ cleared: number }>(sql`
            select private.chat_mark_mentions_read(${workspaceId}::uuid, ${input.conversationId}::uuid,
              ${input.upToNumber ?? null}::integer) as cleared`);
          return { conversationId: input.conversationId, cleared: row!.cleared };
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

  directory() {
    return this.scoped(async (tx) => [...await tx.execute<ChatParticipant>(sql`
      select user_id as id, display_name as name, role, status, coalesce(has_avatar, false) as "hasAvatar"
      from private.chat_directory(${this.workspaceId}::uuid)
    `)]);
  }

  agencyExportMessages() {
    return this.scoped(async (tx) => (await tx.execute<MessageRow>(sql`
      select ${messageColumns} from private.chat_messages m
      where m.workspace_id = ${this.workspaceId}::uuid
        and private.chat_agency_role(${this.workspaceId}::uuid) = 'owner'
        and m.deleted_at is null
        and exists (
          select 1 from private.chat_conversations c
          where c.workspace_id = m.workspace_id and c.id = m.conversation_id
            and (
              c.kind = 'channel'
              or (c.kind = 'direct' and ${this.claims.sub}::uuid in (c.member_low, c.member_high))
            )
        )
      order by m.created_at, m.conversation_id, m.message_number
    `)).map(message));
  }
}

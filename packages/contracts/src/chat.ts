import { z } from "zod";

const cursorSchema = z.number().int().min(0).max(2_147_483_647);
const positiveCursor = cursorSchema.min(1);
const messageBody = z.string().trim().min(1).max(4000).refine((text) => !text.includes("\u0000"));
const channelSlug = z.string().trim().toLowerCase().min(1).max(48).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const conversationId = z.uuid();

const timestamp = z.iso.datetime();
// Emoji corto: la validación estricta (un solo grafema pictográfico) la aplica Postgres.
const reactionEmoji = z.string().trim().min(1).max(16);
export const chatReactionSummarySchema = z.object({
  emoji: reactionEmoji,
  count: positiveCursor,
  userIds: z.array(z.uuid()),
});
export const chatUnreadMentionSchema = z.object({
  messageId: z.uuid(),
  conversationId,
  createdAt: timestamp.optional(),
});

export const chatScopeSchema = z.object({ workspaceId: z.uuid() });
export const chatHistorySchema = chatScopeSchema.extend({
  conversationId,
  before: positiveCursor.optional(),
  threadRootId: z.uuid().optional(),
});
export const chatSyncSchema = chatScopeSchema.extend({
  conversationId: conversationId.optional(),
  after: cursorSchema.default(0),
});
export const chatCommandSchema = z.discriminatedUnion("kind", [
  chatScopeSchema.extend({ kind: z.literal("createChannel"), slug: channelSlug }),
  chatScopeSchema.extend({ kind: z.literal("renameChannel"), conversationId, slug: channelSlug }),
  chatScopeSchema.extend({ kind: z.literal("archiveChannel"), conversationId }),
  chatScopeSchema.extend({ kind: z.literal("openDirect"), recipientId: z.uuid() }),
  chatScopeSchema.extend({
    kind: z.literal("send"),
    conversationId,
    retryKey: z.uuid(),
    body: messageBody,
    replyToId: z.uuid().nullable().optional(),
    threadRootId: z.uuid().nullable().optional(),
    mentionedUserIds: z.array(z.uuid()).max(50).optional(),
  }),
  chatScopeSchema.extend({ kind: z.literal("edit"), conversationId, messageId: z.uuid(), body: messageBody }),
  chatScopeSchema.extend({ kind: z.literal("remove"), conversationId, messageId: z.uuid() }),
  chatScopeSchema.extend({ kind: z.literal("read"), conversationId, through: positiveCursor }),
  chatScopeSchema.extend({
    kind: z.literal("toggleReaction"),
    conversationId,
    messageId: z.uuid(),
    emoji: reactionEmoji,
  }),
  chatScopeSchema.extend({ kind: z.literal("typing"), conversationId }),
  chatScopeSchema.extend({
    kind: z.literal("markMentionsRead"),
    conversationId,
    upToNumber: positiveCursor.optional(),
  }),
]);
export const chatExportSchema = chatScopeSchema.extend({ format: z.enum(["json", "md"]) });

/** Metadatos del adjunto de un mensaje; las URLs firmadas se piden aparte (caducan, no viajan en cada sondeo). */
const chatAttachmentMimeType = z.enum(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]);
export const chatMessageAttachmentSchema = z.object({
  id: z.uuid(),
  fileName: z.string().min(1).max(120),
  mimeType: chatAttachmentMimeType,
  byteSize: positiveCursor,
  width: cursorSchema.nullable(),
  height: cursorSchema.nullable(),
});
export const chatConversationSchema = z.object({
  id: conversationId,
  kind: z.enum(["channel", "direct"]),
  slug: channelSlug.nullable(),
  peerId: z.uuid().nullable(),
  archived: z.boolean(),
  writable: z.boolean(),
  unread: z.boolean(),
  changeCursor: cursorSchema,
});
export const chatMessageSchema = z.object({
  id: z.uuid(),
  conversationId,
  authorId: z.uuid(),
  body: messageBody.nullable(),
  number: positiveCursor,
  change: positiveCursor,
  sentAt: timestamp,
  editedAt: timestamp.nullable(),
  deletedAt: timestamp.nullable(),
  replyToId: z.uuid().nullable().optional(),
  threadRootId: z.uuid().nullable().optional(),
  threadReplyCount: cursorSchema.optional(),
  threadLastReplyAt: timestamp.nullable().optional(),
  reactions: z.array(chatReactionSummarySchema).optional(),
  attachments: z.array(chatMessageAttachmentSchema).optional(),
});
export const chatHistoryResultSchema = z.object({
  conversation: chatConversationSchema,
  messages: z.array(chatMessageSchema),
  before: positiveCursor.nullable(),
});
export const chatSyncResultSchema = z.object({
  conversations: z.array(chatConversationSchema),
  conversationAvailable: z.boolean(),
  changes: z.array(chatMessageSchema),
  after: cursorSchema,
  hasMore: z.boolean(),
  reactions: z.record(z.uuid(), z.array(chatReactionSummarySchema)).optional(),
  typingUserIds: z.array(z.uuid()).optional(),
  unreadMentions: z.array(chatUnreadMentionSchema).optional(),
});
export type ChatReactionSummary = z.infer<typeof chatReactionSummarySchema>;
export type ChatMessageAttachment = z.infer<typeof chatMessageAttachmentSchema>;
export type ChatUnreadMention = z.infer<typeof chatUnreadMentionSchema>;
export type ChatConversation = z.infer<typeof chatConversationSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatCommand = z.infer<typeof chatCommandSchema>;
export type ChatHistory = z.infer<typeof chatHistoryResultSchema>;
export type ChatSync = z.infer<typeof chatSyncResultSchema>;
export type ChatCommandResult = {
  conversationId: string;
  message?: ChatMessage;
  through?: number;
  added?: boolean;
  cleared?: number;
  expiresAt?: string;
};

export const chatParticipantSchema = z.object({
  id: z.uuid(),
  name: z.string().max(60).nullable(),
  role: z.enum(["owner", "admin", "editor", "viewer"]),
  status: z.enum(["online", "away", "dnd"]).nullable(),
  hasAvatar: z.boolean().optional(),
  avatarUrl: z.string().nullable().optional(),
});
export type ChatParticipant = z.infer<typeof chatParticipantSchema>;

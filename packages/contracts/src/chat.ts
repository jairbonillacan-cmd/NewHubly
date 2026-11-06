import { z } from "zod";

const cursorSchema = z.number().int().min(0).max(2_147_483_647);
const positiveCursor = cursorSchema.min(1);
const messageBody = z.string().trim().min(1).max(4000).refine((text) => !text.includes("\u0000"));
const channelSlug = z.string().trim().toLowerCase().min(1).max(48).regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);
const conversationId = z.uuid();

export const chatScopeSchema = z.object({ workspaceId: z.uuid() });
export const chatHistorySchema = chatScopeSchema.extend({ conversationId, before: positiveCursor.optional() });
export const chatSyncSchema = chatScopeSchema.extend({
  conversationId: conversationId.optional(),
  after: cursorSchema.default(0),
});
export const chatCommandSchema = z.discriminatedUnion("kind", [
  chatScopeSchema.extend({ kind: z.literal("createChannel"), slug: channelSlug }),
  chatScopeSchema.extend({ kind: z.literal("renameChannel"), conversationId, slug: channelSlug }),
  chatScopeSchema.extend({ kind: z.literal("archiveChannel"), conversationId }),
  chatScopeSchema.extend({ kind: z.literal("openDirect"), recipientId: z.uuid() }),
  chatScopeSchema.extend({ kind: z.literal("send"), conversationId, retryKey: z.uuid(), body: messageBody }),
  chatScopeSchema.extend({ kind: z.literal("edit"), conversationId, messageId: z.uuid(), body: messageBody }),
  chatScopeSchema.extend({ kind: z.literal("remove"), conversationId, messageId: z.uuid() }),
  chatScopeSchema.extend({ kind: z.literal("read"), conversationId, through: positiveCursor }),
]);
export const chatExportSchema = chatScopeSchema.extend({ format: z.enum(["json", "md"]) });

const timestamp = z.iso.datetime();
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
});
export type ChatConversation = z.infer<typeof chatConversationSchema>;
export type ChatMessage = z.infer<typeof chatMessageSchema>;
export type ChatCommand = z.infer<typeof chatCommandSchema>;
export type ChatHistory = z.infer<typeof chatHistoryResultSchema>;
export type ChatSync = z.infer<typeof chatSyncResultSchema>;
export type ChatCommandResult = { conversationId: string; message?: ChatMessage; through?: number };

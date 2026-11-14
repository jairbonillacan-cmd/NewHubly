import "server-only";
import { sql } from "drizzle-orm";
import { boolean, date, foreignKey, index, integer, jsonb, pgTable, primaryKey, text, time, timestamp, unique, uuid } from "drizzle-orm/pg-core";
// Fuente de verdad: migraciones SQL (supabase/migrations). No usar drizzle-kit push ni generate.

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(), slug: text("slug").notNull().unique(),
  kind: text("kind", { enum: ["personal", "agency"] }).notNull().default("personal"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workspaceMembers = pgTable("workspace_members", {
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull(), role: text("role", { enum: ["owner", "admin", "editor", "viewer"] }).notNull().default("owner"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.workspaceId, t.userId] })]);

export const workspaceInvitations = pgTable("workspace_invitations", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  email: text("email").notNull(), role: text("role", { enum: ["admin", "editor", "viewer"] }).notNull(),
  tokenHash: text("token_hash").notNull().unique(), invitedBy: uuid("invited_by").notNull(),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  acceptedAt: timestamp("accepted_at", { withTimezone: true }), acceptedBy: uuid("accepted_by"),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("workspace_invitations_workspace_status_idx").on(t.workspaceId, t.acceptedAt, t.revokedAt, t.expiresAt)]);

export const notes = pgTable("notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by").notNull(), visibility: text("visibility", { enum: ["private", "workspace"] }).notNull().default("private"),
  title: text("title").notNull().default(""), content: text("content").notNull().default(""),
  isPinned: boolean("is_pinned").notNull().default(false), isArchived: boolean("is_archived").notNull().default(false),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("notes_workspace_id_id_unique").on(t.workspaceId, t.id),
  index("notes_workspace_created_archived_idx").on(t.workspaceId, t.createdBy, t.isArchived),
  index("notes_workspace_visibility_archived_idx").on(t.workspaceId, t.visibility, t.isArchived),
]);

export const todos = pgTable("todos", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by").notNull(), noteId: uuid("note_id"),
  visibility: text("visibility", { enum: ["private", "workspace"] }).notNull().default("private"),
  title: text("title").notNull(), detail: text("detail").notNull().default(""), dueDate: date("due_date"),
  priority: text("priority", { enum: ["low", "medium", "high"] }).notNull().default("medium"),
  isDone: boolean("is_done").notNull().default(false), doneAt: timestamp("done_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("todos_workspace_id_id_unique").on(t.workspaceId, t.id),
  foreignKey({ columns: [t.workspaceId, t.noteId], foreignColumns: [notes.workspaceId, notes.id], name: "todos_workspace_note_fk" }).onDelete("set null"),
  index("todos_workspace_created_done_due_idx").on(t.workspaceId, t.createdBy, t.isDone, t.dueDate),
  index("todos_workspace_visibility_done_due_idx").on(t.workspaceId, t.visibility, t.isDone, t.dueDate),
]);

// Preferencias visuales por persona (#83). La referencia a auth.users vive en la migración (esquema auth, fuera de Drizzle).
export const userPreferences = pgTable("user_preferences", {
  userId: uuid("user_id").primaryKey(),
  wallpaper: text("wallpaper", { enum: ["contornos", "patron", "tinta", "grafito", "imagen"] }).notNull().default("contornos"),
  panelOpacity: integer("panel_opacity").notNull().default(80),
  layoutMode: text("layout_mode", { enum: ["free", "side_by_side", "focus"] }).notNull().default("free"),
  visiblePanels: jsonb("visible_panels").$type<Array<"today" | "open_note" | "pinned_notes">>().notNull(),
  theme: text("theme", { enum: ["light", "dark", "system"] }).notNull().default("light"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export type WorkspaceKind = "personal" | "agency"; export type WorkspaceRole = "owner" | "admin" | "editor" | "viewer"; export type ItemVisibility = "private" | "workspace";
export type Workspace = typeof workspaces.$inferSelect; export type NewWorkspace = typeof workspaces.$inferInsert;
export type WorkspaceMember = typeof workspaceMembers.$inferSelect; export type NewWorkspaceMember = typeof workspaceMembers.$inferInsert;
export type WorkspaceInvitation = typeof workspaceInvitations.$inferSelect; export type NewWorkspaceInvitation = typeof workspaceInvitations.$inferInsert;
export type Note = typeof notes.$inferSelect; export type NewNote = typeof notes.$inferInsert;
export type Todo = typeof todos.$inferSelect; export type NewTodo = typeof todos.$inferInsert;
export type UserPreferencesRow = typeof userPreferences.$inferSelect;

export const brands = pgTable("brands", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by").notNull(),
  name: text("name").notNull(),
  color: text("color", { enum: ["azul", "arena", "verde", "lila"] }).notNull().default("azul"),
  visibility: text("visibility", { enum: ["private", "workspace"] }).notNull().default("workspace"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("brands_workspace_id_id_unique").on(t.workspaceId, t.id),
  index("brands_workspace_archived_idx").on(t.workspaceId, t.archivedAt),
]);

export const contentPieces = pgTable("content_pieces", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  brandId: uuid("brand_id"),
  createdBy: uuid("created_by").notNull(),
  title: text("title").notNull(),
  brief: text("brief").notNull().default(""),
  campaign: text("campaign").notNull().default(""),
  channel: text("channel", { enum: ["instagram", "facebook", "tiktok", "linkedin", "x", "youtube", "blog", "email", "otro"] }).notNull().default("instagram"),
  plannedDate: date("planned_date", { mode: "string" }).notNull(),
  plannedTime: time("planned_time"),
  assigneeId: uuid("assignee_id"),
  status: text("status", { enum: ["idea", "borrador", "revision", "aprobacion_cliente", "programada", "aprobada", "publicada", "medida"] }).notNull().default("idea"),
  publishedDate: date("published_date", { mode: "string" }),
  visibility: text("visibility", { enum: ["private", "workspace"] }).notNull().default("workspace"),
  archivedAt: timestamp("archived_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("content_pieces_workspace_id_id_unique").on(t.workspaceId, t.id),
  foreignKey({ columns: [t.workspaceId, t.brandId], foreignColumns: [brands.workspaceId, brands.id], name: "content_pieces_workspace_brand_fk" }).onDelete("set null"),
  // El on delete set null de brand_id en la FK compuesta (PostgreSQL 15+) lo gobierna la migración SQL
  // de contenido: al borrar la marca, la pieza sobrevive con brand_id en null (#228).
  index("content_pieces_workspace_planned_date_idx").on(t.workspaceId, t.plannedDate),
  index("content_pieces_workspace_brand_idx").on(t.workspaceId, t.brandId),
]);

export const contentPieceEvents = pgTable("content_piece_events", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  pieceId: uuid("piece_id").notNull(),
  kind: text("kind", { enum: ["created", "status", "rescheduled", "assigned"] }).notNull(),
  from: text("from"),
  to: text("to"),
  actorId: uuid("actor_id").notNull(),
  // clock_timestamp(), como la migración (#228): now() congela la hora de inicio de la transacción y
  // varios eventos en la misma transacción quedarían con la misma marca.
  at: timestamp("at", { withTimezone: true }).default(sql`clock_timestamp()`).notNull(),
}, (t) => [
  foreignKey({ columns: [t.workspaceId, t.pieceId], foreignColumns: [contentPieces.workspaceId, contentPieces.id], name: "content_piece_events_workspace_piece_fk" }).onDelete("cascade"),
  index("content_piece_events_piece_at_idx").on(t.pieceId, t.at),
]);

export type BrandRow = typeof brands.$inferSelect; export type NewBrandRow = typeof brands.$inferInsert;
export type ContentPieceRow = typeof contentPieces.$inferSelect; export type NewContentPieceRow = typeof contentPieces.$inferInsert;
export type ContentPieceEventRow = typeof contentPieceEvents.$inferSelect;

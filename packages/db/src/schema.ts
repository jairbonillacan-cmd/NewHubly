import "server-only";
import { boolean, date, foreignKey, index, integer, jsonb, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
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
  wallpaper: text("wallpaper", { enum: ["contornos", "patron", "tinta", "grafito", "puntos", "cuadricula", "aurora", "hubis", "arena", "aurora-polar", "bosque-de-niebla", "dunas-de-cobre", "herbario-de-tinta", "jardin-japones", "jardin-submarino", "lluvia-en-casa", "luz-de-cantera", "marea-lenta", "papel-plegado", "refugio-alpino", "tokio-nocturno", "imagen"] }).notNull().default("contornos"),
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

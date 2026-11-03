import "server-only";
import { boolean, date, foreignKey, index, integer, pgTable, primaryKey, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
// Fuente de verdad: migraciones SQL (supabase/migrations). No usar drizzle-kit push ni generate.

export const workspaces = pgTable("workspaces", {
  id: uuid("id").primaryKey().defaultRandom(),
  name: text("name").notNull(), slug: text("slug").notNull().unique(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workspaceMembers = pgTable("workspace_members", {
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: uuid("user_id").notNull(), role: text("role").notNull().default("owner"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.workspaceId, t.userId] })]);

export const notes = pgTable("notes", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by").notNull(),
  title: text("title").notNull().default(""), content: text("content").notNull().default(""),
  isPinned: boolean("is_pinned").notNull().default(false), isArchived: boolean("is_archived").notNull().default(false),
  version: integer("version").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("notes_workspace_id_id_unique").on(t.workspaceId, t.id),
  index("notes_workspace_created_archived_idx").on(t.workspaceId, t.createdBy, t.isArchived),
]);

export const todos = pgTable("todos", {
  id: uuid("id").primaryKey().defaultRandom(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  createdBy: uuid("created_by").notNull(), noteId: uuid("note_id"),
  title: text("title").notNull(), detail: text("detail").notNull().default(""), dueDate: date("due_date"),
  priority: text("priority", { enum: ["low", "medium", "high"] }).notNull().default("medium"),
  isDone: boolean("is_done").notNull().default(false), doneAt: timestamp("done_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  unique("todos_workspace_id_id_unique").on(t.workspaceId, t.id),
  foreignKey({ columns: [t.workspaceId, t.noteId], foreignColumns: [notes.workspaceId, notes.id], name: "todos_workspace_note_fk" }).onDelete("set null"),
  index("todos_workspace_created_done_due_idx").on(t.workspaceId, t.createdBy, t.isDone, t.dueDate),
]);

export type Workspace = typeof workspaces.$inferSelect; export type NewWorkspace = typeof workspaces.$inferInsert;
export type WorkspaceMember = typeof workspaceMembers.$inferSelect; export type NewWorkspaceMember = typeof workspaceMembers.$inferInsert;
export type Note = typeof notes.$inferSelect; export type NewNote = typeof notes.$inferInsert;
export type Todo = typeof todos.$inferSelect; export type NewTodo = typeof todos.$inferInsert;

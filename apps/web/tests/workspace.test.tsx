import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { createTodoAction, exportWorkspaceAction, saveNoteAction } from "../src/actions";
import { WorkspaceScreen, classifyTodoItemForView, shouldTriggerQuickCaptureShortcut } from "../src/components/WorkspaceScreen";

describe("Pantalla Hoy, atajos, Server Actions y exportación (#27)", () => {
  it("renderiza los 4 estados obligatorios de pantalla terminada (carga, sin sesión, error y listo/vacío)", () => {
    expect(renderToStaticMarkup(<WorkspaceScreen initialStatus="loading" />)).toContain("Cargando tu espacio de trabajo…");
    expect(renderToStaticMarkup(<WorkspaceScreen initialStatus="unauthenticated" />)).toContain("Volver a iniciar sesión");
    expect(renderToStaticMarkup(<WorkspaceScreen initialStatus="error" errorMessage="Fallo de red" />)).toContain("Reintentar");
    const emptyHtml = renderToStaticMarkup(<WorkspaceScreen initialStatus="ready" todayDate="2026-11-03" />);
    expect(emptyHtml).toContain("No tienes pendientes para hoy. Escribe arriba para capturar el primero o revisa Sin fecha.");
    expect(emptyHtml).toContain("Exportar JSON");
    expect(emptyHtml).toContain("Exportar Markdown");
  });

  it("renderiza pendientes vencidos, vínculo nota -> pendiente, notas fijadas y estado de autoguardado con @hubly/ui", () => {
    const html = renderToStaticMarkup(
      <WorkspaceScreen
        todayDate="2026-11-03"
        initialNotes={[{ id: "n-1", workspaceId: "w-1", createdBy: "u-1", title: "Estrategia Q4", content: "Objetivos", isPinned: true, isArchived: false, version: 2, createdAt: "2026-11-03T10:00:00Z", updatedAt: "2026-11-03T10:00:00Z" }]}
        initialTodos={[{ id: "t-1", workspaceId: "w-1", createdBy: "u-1", noteId: "n-1", title: "Revisar presupuesto", detail: "Urgente", dueDate: "2026-11-01", priority: "high", isDone: false, doneAt: null, createdAt: "2026-11-03T10:00:00Z", updatedAt: "2026-11-03T10:00:00Z" }]}
      />,
    );
    expect(html).toContain("Vencido · 2026-11-01");
    expect(html).toContain("Nota de origen: Estrategia Q4");
    expect(html).toContain("Crear pendiente desde esta nota");
    expect(html).toContain("Revisar presupuesto · Pendiente");
    expect(html).toContain("Guardado");
  });

  it("evalúa correctamente el atajo global 'c' y '/' ignorando inputs editables y clasifica vistas", () => {
    expect(shouldTriggerQuickCaptureShortcut("c", "DIV", false)).toBe(true);
    expect(shouldTriggerQuickCaptureShortcut("/", "BODY", false)).toBe(true);
    expect(shouldTriggerQuickCaptureShortcut("c", "INPUT", false)).toBe(false);
    expect(shouldTriggerQuickCaptureShortcut("/", "TEXTAREA", false)).toBe(false);
    expect(shouldTriggerQuickCaptureShortcut("c", "DIV", true)).toBe(false);
    const base = { id: "1", workspaceId: "w", createdBy: "u", noteId: null, title: "T", detail: "", priority: "medium" as const, isDone: false, doneAt: null, createdAt: "", updatedAt: "" };
    expect(classifyTodoItemForView({ ...base, dueDate: "2026-11-02" }, "2026-11-03")).toBe("today");
    expect(classifyTodoItemForView({ ...base, dueDate: "2026-11-05" }, "2026-11-03")).toBe("upcoming");
    expect(classifyTodoItemForView({ ...base, dueDate: null }, "2026-11-03")).toBe("no_date");
    expect(classifyTodoItemForView({ ...base, isDone: true }, "2026-11-03")).toBe("done");
  });

  it("Server Actions exigen expectedVersion en autoguardado, validan contratos y generan nombres de exportación", async () => {
    const session = { claims: { sub: "u-1", role: "authenticated" as const }, workspaceId: "w-1" };
    await expect(saveNoteAction(session, { id: "n-1", content: "Sin versión" })).rejects.toThrow();
    await expect(createTodoAction(session, { title: "   " })).rejects.toThrow("El título es obligatorio");
    const now = new Date("2026-11-03T10:00:00.000Z");
    const nameOf = (t: unknown) => (t as { [k: symbol]: string })?.[Symbol.for("drizzle:Name")];
    const tx = {
      execute: vi.fn().mockResolvedValue([]),
      select: vi.fn().mockImplementation(() => ({
        from: (table: unknown) => ({
          where: () => {
            const n = nameOf(table);
            const rows = n === "notes"
              ? [{ id: "n-1", workspaceId: "w-1", createdBy: "u-1", title: "Nota", content: "C", isPinned: true, isArchived: false, version: 1, createdAt: now, updatedAt: now }]
              : n === "todos"
                ? [{ id: "t-1", workspaceId: "w-1", createdBy: "u-1", noteId: "n-1", title: "Tarea", detail: "D", dueDate: "2026-11-03", priority: "high", isDone: false, doneAt: null, createdAt: now, updatedAt: now }]
                : [{ workspaceId: "w-1", userId: "u-1", role: "owner", createdAt: now }];
            return { limit: async (c: number) => rows.slice(0, c), orderBy: async () => rows };
          },
        }),
      })),
    };
    const mockDb = { transaction: vi.fn().mockImplementation((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const exp = await exportWorkspaceAction(session, mockDb as any);
    expect(exp.jsonFilename).toMatch(/^hubly-export-\d{4}-\d{2}-\d{2}\.json$/);
    expect(exp.mdFilename).toMatch(/^hubly-export-\d{4}-\d{2}-\d{2}\.md$/);
    expect(exp.markdownContent).toContain("## Nota [Fijada]");
  });
});

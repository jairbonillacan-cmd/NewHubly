import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import {
  createNoteAction,
  createTodoAction,
  createTodoFromNoteAction,
  exportWorkspaceAction,
  listNotesAction,
  listTodosByViewAction,
  provisionPersonalWorkspaceAction,
  saveNoteAction,
  toggleTodoAction,
} from "../../src/actions";
import { WorkspaceScreen, shouldTriggerQuickCaptureShortcut } from "../../src/components/WorkspaceScreen";

describe("Flujo E2E Completo Fase 1A contra Postgres real en Docker (#28)", { timeout: 30000 }, () => {
  const runId = Math.random().toString(36).slice(2, 10);
  const claimsA = { sub: crypto.randomUUID(), role: "authenticated" as const };
  const claimsB = { sub: crypto.randomUUID(), role: "authenticated" as const };
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

  it("ejecuta flujo diario en Hoy (atajo 'c', captura, hecho, nota con autoguardado, pendiente desde nota) y exportación íntegra con aislamiento RLS", async () => {
    const wsAId = await provisionPersonalWorkspaceAction(claimsA, "Espacio E2E A", `e2e-a-${runId}`);
    const wsBId = await provisionPersonalWorkspaceAction(claimsB, "Espacio E2E B", `e2e-b-${runId}`);
    const sessionA = { claims: claimsA, workspaceId: wsAId, timezone: "UTC" };
    const sessionB = { claims: claimsB, workspaceId: wsBId, timezone: "UTC" };

    // 1. Carga inicial de la vista Hoy (vacía en Postgres real)
    expect(await listTodosByViewAction(sessionA, "today")).toEqual([]);
    expect(await listNotesAction(sessionA)).toEqual([]);
    const initialHtml = renderToStaticMarkup(<WorkspaceScreen initialStatus="ready" todayDate={today} initialTodos={[]} initialNotes={[]} />);
    expect(initialHtml).toContain("No tienes pendientes para hoy");

    // 2. Atajo de teclado 'c' y captura rápida de pendiente en Hoy
    expect(shouldTriggerQuickCaptureShortcut("c", "BODY", false)).toBe(true);
    expect(shouldTriggerQuickCaptureShortcut("c", "INPUT", false)).toBe(false);
    const capturedTodo = await createTodoAction(sessionA, { title: "Publicar parrilla mensual", priority: "high", dueDate: today });
    const todayAfterCapture = await listTodosByViewAction(sessionA, "today");
    expect(todayAfterCapture.map((t) => t.id)).toEqual([capturedTodo.id]);
    const captureHtml = renderToStaticMarkup(<WorkspaceScreen todayDate={today} initialTodos={todayAfterCapture} initialNotes={[]} />);
    expect(captureHtml).toContain("Publicar parrilla mensual");

    // 3. Marcado de pendiente como hecho y paso a la vista de Hechos
    const toggledTodo = await toggleTodoAction(sessionA, capturedTodo.id);
    expect(toggledTodo.isDone).toBe(true);
    expect(toggledTodo.doneAt).toBeTruthy();
    expect(await listTodosByViewAction(sessionA, "today")).toEqual([]);
    const doneTodos = await listTodosByViewAction(sessionA, "done");
    expect(doneTodos.map((t) => t.id)).toEqual([capturedTodo.id]);
    const doneHtml = renderToStaticMarkup(<WorkspaceScreen todayDate={today} initialView="done" initialTodos={doneTodos} initialNotes={[]} />);
    expect(doneHtml).toContain("Publicar parrilla mensual");

    // 4. Creación de nota y autoguardado con control de concurrencia optimista (badge Guardado)
    const createdNote = await createNoteAction(sessionA, { title: "Minuta cliente Q4", content: "Borrador inicial" });
    expect(createdNote.version).toBe(1);
    const savedNote = await saveNoteAction(sessionA, { id: createdNote.id, title: "Minuta cliente Q4", content: "Borrador validado y guardado", isPinned: true, expectedVersion: 1 });
    expect(savedNote.version).toBe(2);
    await expect(saveNoteAction(sessionA, { id: createdNote.id, content: "Versión obsoleta", expectedVersion: 1 })).rejects.toThrow();

    // 5. Generación de pendiente derivado desde la nota creada conservando el vínculo
    const derivedTodo = await createTodoFromNoteAction(sessionA, savedNote.id, { title: "Enviar minuta por correo", detail: "Adjuntar métricas", dueDate: today, priority: "medium" });
    expect(derivedTodo.noteId).toBe(savedNote.id);
    const activeNotes = await listNotesAction(sessionA);
    const todayTodos = await listTodosByViewAction(sessionA, "today");
    const linkedHtml = renderToStaticMarkup(<WorkspaceScreen todayDate={today} initialTodos={todayTodos} initialNotes={activeNotes} />);
    expect(linkedHtml).toContain("Guardado");
    expect(linkedHtml).toContain("Nota de origen: Minuta cliente Q4");
    expect(linkedHtml).toContain("Enviar minuta por correo · Pendiente");

    // 6. Aislamiento multi-inquilino desde Server Actions: Usuario B no lee ni exporta datos de Usuario A
    expect(await listNotesAction(sessionB)).toEqual([]);
    expect(await listTodosByViewAction(sessionB, "today")).toEqual([]);
    expect(await listTodosByViewAction(sessionB, "done")).toEqual([]);
    await expect(listNotesAction({ claims: claimsB, workspaceId: wsAId })).rejects.toThrow("No autorizado en el espacio de trabajo");

    // 7. Exportación de datos (Constitución #5): JSON y Markdown contienen exactamente los datos reales sin pérdida
    const exported = await exportWorkspaceAction(sessionA);
    expect(exported.jsonFilename).toBe(`hubly-export-${today}.json`);
    expect(exported.mdFilename).toBe(`hubly-export-${today}.md`);
    const parsedJson = JSON.parse(exported.jsonContent);
    expect(parsedJson.version).toBe(1);
    expect(parsedJson.notes).toHaveLength(1);
    expect(parsedJson.notes[0]).toMatchObject({ id: savedNote.id, title: "Minuta cliente Q4", content: "Borrador validado y guardado", isPinned: true, isArchived: false, version: 2 });
    expect(parsedJson.todos).toHaveLength(2);
    expect(parsedJson.todos.find((t: { id: string }) => t.id === capturedTodo.id)).toMatchObject({ title: "Publicar parrilla mensual", isDone: true, noteId: null });
    expect(parsedJson.todos.find((t: { id: string }) => t.id === derivedTodo.id)).toMatchObject({ title: "Enviar minuta por correo", detail: "Adjuntar métricas", isDone: false, noteId: savedNote.id });
    expect(exported.markdownContent).toContain("## Minuta cliente Q4 [Fijada]");
    expect(exported.markdownContent).toContain("Borrador validado y guardado");
    expect(exported.markdownContent).toContain(`- [x] [ALTA] Publicar parrilla mensual (Vence: ${today})`);
    expect(exported.markdownContent).toContain(`- [ ] [NORMAL] Enviar minuta por correo (Vence: ${today}) (Nota: ${savedNote.id})\n  Adjuntar métricas`);
  });
});

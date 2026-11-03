import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { NoteEditorCard, QuickCaptureBar, TodoItemCard, ViewSelector, WORKSPACE_EMPTY_MESSAGES, WorkspaceEmptyState } from "../index";

function findElements(node: unknown, predicate: (el: { type: unknown; props: Record<string, unknown> }) => boolean): Array<{ type: unknown; props: Record<string, unknown> }> {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap((child) => findElements(child, predicate));
  const el = node as { type?: unknown; props?: Record<string, unknown> };
  const matches = el.props && predicate({ type: el.type, props: el.props }) ? [{ type: el.type, props: el.props }] : [];
  const children = el.props ? Object.values(el.props) : Object.values(node);
  return [...matches, ...children.flatMap((child) => findElements(child, predicate))];
}

describe("Componentes UI de Notas y Pendientes de Fase 1A (@hubly/ui, Issue #26)", () => {
  it("QuickCaptureBar dispara onSubmit al presionar Enter y expone atributos accesibles y borde de control", () => {
    const onSubmit = vi.fn();
    const tree = QuickCaptureBar({ title: "  Preparar pauta mensual  ", priority: "high", dueDate: "2026-11-10", linkedNoteTitle: "Brief Q4", onSubmit });
    const html = renderToStaticMarkup(createElement(QuickCaptureBar, { title: "Preparar pauta", priority: "high" }));
    expect(html).toContain("Capturar pendiente rápido… [Enter]");
    expect(html).toContain("var(--border-control)");
    const textInput = findElements(tree, (el) => el.type === "input" && el.props["type"] === "text")[0];
    (textInput?.props["onKeyDown"] as (e: { key: string; preventDefault: () => void }) => void)({ key: "Enter", preventDefault: () => {} });
    expect(onSubmit).toHaveBeenCalledWith({ title: "Preparar pauta mensual", priority: "high", dueDate: "2026-11-10" });
  });

  it("TodoItemCard alterna el checkbox con Space o cambio, refleja aria-checked y enlaza a la nota de origen", () => {
    const onToggle = vi.fn();
    const tree = TodoItemCard({ id: "todo-1", title: "Revisar creatividades", detail: "Validar formatos verticales", priority: "high", dueDate: "2026-11-01", isDone: false, isOverdue: true, noteId: "note-9", noteTitle: "Reunión creativa", onToggle });
    const html = renderToStaticMarkup(createElement(TodoItemCard, { id: "todo-1", title: "Revisar creatividades", priority: "high", dueDate: "2026-11-01", isDone: true, isOverdue: false, noteId: "note-9" }));
    expect(html).toContain('role="checkbox"');
    expect(html).toContain('aria-checked="true"');
    expect(renderToStaticMarkup(tree)).toContain("Vencido · 2026-11-01");
    expect(renderToStaticMarkup(tree)).toContain("Nota de origen: Reunión creativa");
    const checkbox = findElements(tree, (el) => el.props["role"] === "checkbox")[0];
    (checkbox?.props["onKeyDown"] as (e: { key: string; preventDefault: () => void }) => void)({ key: " ", preventDefault: () => {} });
    (checkbox?.props["onChange"] as () => void)();
    expect(onToggle).toHaveBeenCalledTimes(2);
    expect(onToggle).toHaveBeenCalledWith("todo-1");
  });

  it("NoteEditorCard renderiza los 3 estados de autoguardado, acciones Fijar/Archivar y creación de pendiente vinculado", () => {
    const onRetrySave = vi.fn();
    const savingHtml = renderToStaticMarkup(createElement(NoteEditorCard, { id: "n1", title: "Ideas", content: "Texto", isPinned: false, isArchived: false, saveStatus: "saving" }));
    const savedHtml = renderToStaticMarkup(createElement(NoteEditorCard, { id: "n1", title: "Ideas", content: "Texto", isPinned: true, isArchived: false, saveStatus: "saved" }));
    const errorTree = NoteEditorCard({ id: "n1", title: "Ideas", content: "Texto", isPinned: true, isArchived: false, saveStatus: "error", linkedTodos: [{ id: "t1", title: "Subir arte", isDone: false }], onRetrySave });
    const errorHtml = renderToStaticMarkup(errorTree);
    expect(savingHtml).toContain("Guardando…");
    expect(savedHtml).toContain("Guardado");
    expect(savedHtml).toContain("--status-success-bg");
    expect(errorHtml).toContain("No se pudo guardar · Reintentar");
    expect(errorHtml).toContain("--status-danger-bg");
    expect(errorHtml).toContain("Subir arte · Pendiente");
    const retryBtn = findElements(errorTree, (el) => el.props["aria-label"] === "Reintentar guardado de nota")[0];
    (retryBtn?.props["onClick"] as () => void)();
    expect(onRetrySave).toHaveBeenCalledWith("n1");
  });

  it("ViewSelector expone role=tablist, aria-selected, contadores y navegación con ArrowRight/ArrowLeft", () => {
    const onSelectView = vi.fn();
    const tree = ViewSelector({ activeView: "today", counts: { today: 3, upcoming: 5, no_date: 1, done: 8 }, onSelectView });
    const html = renderToStaticMarkup(tree);
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain("(3)");
    const tabs = findElements(tree, (el) => el.props["role"] === "tab");
    expect(tabs).toHaveLength(4);
    (tabs[0]?.props["onKeyDown"] as (e: { key: string; preventDefault: () => void }) => void)({ key: "ArrowRight", preventDefault: () => {} });
    expect(onSelectView).toHaveBeenCalledWith("upcoming");
    (tabs[0]?.props["onKeyDown"] as (e: { key: string; preventDefault: () => void }) => void)({ key: "ArrowLeft", preventDefault: () => {} });
    expect(onSelectView).toHaveBeenCalledWith("done");
  });

  it("WorkspaceEmptyState muestra las 4 variantes honestas sin emojis ni datos simulados", () => {
    for (const view of ["today", "upcoming", "no_date", "done"] as const) {
      expect(renderToStaticMarkup(createElement(WorkspaceEmptyState, { view }))).toContain(WORKSPACE_EMPTY_MESSAGES[view]);
    }
  });
});

import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  Button,
  Card,
  Checkbox,
  Chip,
  EmptyState,
  Input,
  Kbd,
  NoteEditorCard,
  QuickCaptureBar,
  Switch,
  Tabs,
  TextArea,
  TextField,
  TodoItemCard,
  ViewSelector,
  WORKSPACE_EMPTY_MESSAGES,
  WorkspaceEmptyState,
} from "../index";

function findElements(node: unknown, predicate: (el: { type: unknown; props: Record<string, unknown> }) => boolean): Array<{ type: unknown; props: Record<string, unknown> }> {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap((child) => findElements(child, predicate));
  const el = node as { type?: unknown; props?: Record<string, unknown> };
  const matches = el.props && predicate({ type: el.type, props: el.props }) ? [{ type: el.type, props: el.props }] : [];
  const children = el.props ? Object.values(el.props) : Object.values(node);
  return [...matches, ...children.flatMap((child) => findElements(child, predicate))];
}

describe("Componentes UI de Notas y Pendientes con dirección visual y HeroUI (@hubly/ui, Issues #26 y #47)", () => {
  it("reexporta las primitivas reales de @heroui/react desde @hubly/ui para consumo en apps/web", () => {
    expect(typeof Button).toBe("function");
    expect(typeof Card).toBe("function");
    expect(typeof Tabs).toBe("function");
    expect(typeof Checkbox).toBe("function");
    expect(typeof TextField).toBe("function");
    expect(typeof Input).toBe("function");
    expect(typeof TextArea).toBe("function");
    expect(typeof Chip).toBe("function");
    expect(typeof Kbd).toBe("function");
    expect(typeof Switch).toBe("function");
    expect(typeof EmptyState).toBe("function");
  });

  it("QuickCaptureBar usa Card de cristal, Kbd, TextField, Input y Button reales de HeroUI y dispara onSubmit con Enter", () => {
    const onSubmit = vi.fn();
    const tree = QuickCaptureBar({ title: "  Preparar pauta mensual  ", priority: "high", dueDate: "2026-11-10", linkedNoteTitle: "Brief Q4", onSubmit });
    const html = renderToStaticMarkup(createElement(QuickCaptureBar, { title: "Preparar pauta", priority: "high" }));
    expect(html).toContain('data-slot="card"');
    expect(html).toContain('data-slot="textfield"');
    expect(html).toContain('data-slot="input"');
    expect(html).toContain('data-slot="button"');
    expect(html).toContain("<kbd");
    expect(html).toContain("var(--glass-bg)");
    expect(html).toContain("var(--accent-warm)");
    expect(html).toContain("var(--border-control)");
    expect(html).toContain("Capturar pendiente rápido… [Enter]");
    const textInput = findElements(tree, (el) => el.props["type"] === "text")[0];
    (textInput?.props["onKeyDown"] as (e: { key: string; preventDefault: () => void }) => void)({ key: "Enter", preventDefault: () => {} });
    expect(onSubmit).toHaveBeenCalledWith({ title: "Preparar pauta mensual", priority: "high", dueDate: "2026-11-10" });
  });

  it("TodoItemCard usa Card del bento, Checkbox y Chip reales de HeroUI y enlaza a la nota de origen", () => {
    const onToggle = vi.fn();
    const tree = TodoItemCard({ id: "todo-1", title: "Revisar creatividades", detail: "Validar formatos verticales", priority: "high", dueDate: "2026-11-01", isDone: false, isOverdue: true, noteId: "note-9", noteTitle: "Reunión creativa", onToggle });
    const html = renderToStaticMarkup(createElement(TodoItemCard, { id: "todo-1", title: "Revisar creatividades", priority: "high", dueDate: "2026-11-01", isDone: true, isOverdue: false, noteId: "note-9" }));
    expect(html).toContain('data-slot="card"');
    expect(html).toContain('data-slot="checkbox"');
    expect(html).toContain('data-slot="chip"');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain("var(--bento-card-bg)");
    expect(renderToStaticMarkup(tree)).toContain("Vencido · 2026-11-01");
    expect(renderToStaticMarkup(tree)).toContain("Nota de origen: Reunión creativa");
    const rootCheckbox = findElements(tree, (el) => typeof el.props["onChange"] === "function")[0];
    (rootCheckbox?.props["onChange"] as () => void)();
    expect(onToggle).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledWith("todo-1");
  });

  it("NoteEditorCard usa Card crema, Chip de autoguardado, TextField/Input/TextArea y Button reales de HeroUI", () => {
    const onRetrySave = vi.fn();
    const savingHtml = renderToStaticMarkup(createElement(NoteEditorCard, { id: "n1", title: "Ideas", content: "Texto", isPinned: false, isArchived: false, saveStatus: "saving" }));
    const savedHtml = renderToStaticMarkup(createElement(NoteEditorCard, { id: "n1", title: "Ideas", content: "Texto", isPinned: true, isArchived: false, saveStatus: "saved" }));
    const errorTree = NoteEditorCard({ id: "n1", title: "Ideas", content: "Texto", isPinned: true, isArchived: false, saveStatus: "error", linkedTodos: [{ id: "t1", title: "Subir arte", isDone: false }], onRetrySave });
    const errorHtml = renderToStaticMarkup(errorTree);
    expect(savingHtml).toContain("Guardando…");
    expect(savedHtml).toContain("Guardado");
    expect(savedHtml).toContain('data-slot="card"');
    expect(savedHtml).toContain('data-slot="chip"');
    expect(savedHtml).toContain('data-slot="textfield"');
    expect(savedHtml).toContain('data-slot="textarea"');
    expect(savedHtml).toContain("var(--bento-card-bg)");
    expect(savedHtml).toContain("--status-success-bg");
    expect(errorHtml).toContain("No se pudo guardar · Reintentar");
    expect(errorHtml).toContain("--status-danger-bg");
    expect(errorHtml).toContain("Subir arte · Pendiente");
    const retryBtn = findElements(errorTree, (el) => el.props["aria-label"] === "Reintentar guardado de nota")[0];
    (retryBtn?.props["onClick"] as () => void)();
    expect(onRetrySave).toHaveBeenCalledWith("n1");
  });

  it("ViewSelector usa Tabs, Tabs.List, Tabs.Tab y Chip con estilo de píldoras y navegación por teclado", () => {
    const onSelectView = vi.fn();
    const tree = ViewSelector({ activeView: "today", counts: { today: 3, upcoming: 5, no_date: 1, done: 8 }, onSelectView });
    const html = renderToStaticMarkup(createElement(ViewSelector, { activeView: "today", counts: { today: 3, upcoming: 5, no_date: 1, done: 8 } }));
    expect(html).toContain('data-slot="tabs"');
    expect(html).toContain('data-slot="tabs-list"');
    expect(html).toContain('data-slot="tabs-tab"');
    expect(html).toContain('role="tablist"');
    expect(html).toContain('aria-selected="true"');
    expect(html).toContain("var(--pill-active-bg)");
    expect(html).toContain("(3)");
    const tabsRoot = findElements(tree, (el) => typeof el.props["onSelectionChange"] === "function")[0];
    expect(tabsRoot).toBeDefined();
    (tabsRoot?.props["onSelectionChange"] as (key: string) => void)("upcoming");
    expect(onSelectView).toHaveBeenCalledWith("upcoming");
    (tabsRoot?.props["onSelectionChange"] as (key: string) => void)("done");
    expect(onSelectView).toHaveBeenCalledWith("done");
  });

  it("WorkspaceEmptyState usa EmptyState y Button de HeroUI con tokens del bento en las 4 vistas", () => {
    for (const view of ["today", "upcoming", "no_date", "done"] as const) {
      const html = renderToStaticMarkup(createElement(WorkspaceEmptyState, { view, actionLabel: "Capturar", onAction: () => {} }));
      expect(html).toContain(WORKSPACE_EMPTY_MESSAGES[view]);
      expect(html).toContain("var(--bento-card-bg)");
      expect(html).toContain('data-slot="button"');
    }
  });
});

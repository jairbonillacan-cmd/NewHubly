import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  AgencyTeamPanel, Button, Card, Checkbox, Chip, EmptyState, getAssignableRolesForMember, Hubi, HublySymbol, HublyWordmark,
  Input, Kbd, NoteEditorCard, QuickCaptureBar, Switch, Tabs, TextArea, TextField, TodoItemCard, ViewSelector,
  WORKSPACE_EMPTY_MESSAGES, WORKSPACE_ROLE_LABELS, WorkspaceEmptyState,
} from "../index";

function findElements(node: unknown, predicate: (el: { type: unknown; props: Record<string, unknown> }) => boolean): Array<{ type: unknown; props: Record<string, unknown> }> {
  if (!node || typeof node !== "object") return [];
  if (Array.isArray(node)) return node.flatMap((child) => findElements(child, predicate));
  const el = node as { type?: unknown; props?: Record<string, unknown> };
  const matches = el.props && predicate({ type: el.type, props: el.props }) ? [{ type: el.type, props: el.props }] : [];
  const children = el.props ? Object.values(el.props) : Object.values(node);
  return [...matches, ...children.flatMap((child) => findElements(child, predicate))];
}

describe("Componentes UI de Notas, Pendientes, Agencias y Equipo con dirección visual y HeroUI (@hubly/ui, Issues #26, #47, #52 y #64)", () => {
  it("reexporta las primitivas reales de @heroui/react desde @hubly/ui para consumo en apps/web", () => {
    for (const primitive of [Button, Card, Tabs, Checkbox, TextField, Input, TextArea, Chip, Kbd, Switch, EmptyState]) {
      expect(typeof primitive).toBe("function");
    }
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
    expect(html).toContain("var(--accent-primary)");
    expect(html).toContain("var(--border-control)");
    expect(html).toContain("Capturar pendiente rápido… [Enter]");
    const textInput = findElements(tree, (el) => el.props["type"] === "text")[0];
    (textInput?.props["onKeyDown"] as (e: { key: string; preventDefault: () => void }) => void)({ key: "Enter", preventDefault: () => {} });
    expect(onSubmit).toHaveBeenCalledWith({ title: "Preparar pauta mensual", priority: "high", dueDate: "2026-11-10" });
  });

  it("TodoItemCard usa Card del bento, Checkbox, Chip de visibilidad y alterna entre Privado y Compartido con agencia", () => {
    const onToggle = vi.fn();
    const onChangeVisibility = vi.fn();
    const tree = TodoItemCard({ id: "todo-1", title: "Revisar creatividades", detail: "Validar formatos verticales", priority: "high", dueDate: "2026-11-01", isDone: false, isOverdue: true, visibility: "private", canChangeVisibility: true, noteId: "note-9", noteTitle: "Reunión creativa", onToggle, onChangeVisibility });
    const html = renderToStaticMarkup(createElement(TodoItemCard, { id: "todo-1", title: "Revisar creatividades", priority: "high", dueDate: "2026-11-01", isDone: true, isOverdue: false, visibility: "workspace", noteId: "note-9" }));
    expect(html).toContain('data-slot="card"');
    expect(html).toContain('data-slot="checkbox"');
    expect(html).toContain('data-slot="chip"');
    expect(html).toContain('type="checkbox"');
    expect(html).toContain('data-selected="true"');
    expect(html).toContain("var(--bento-card-bg)");
    expect(html).toContain("Compartido con agencia");
    expect(renderToStaticMarkup(tree)).toContain("Privado");
    expect(renderToStaticMarkup(tree)).toContain("Compartir con agencia");
    expect(renderToStaticMarkup(createElement(TodoItemCard, { id: "todo-1", title: "Revisar creatividades", priority: "high", dueDate: "2026-11-01", isDone: false, isOverdue: true, noteId: "note-9", noteTitle: "Reunión creativa" }))).toContain("Vencido · 2026-11-01");
    const rootCheckbox = findElements(tree, (el) => typeof el.props["onChange"] === "function")[0];
    (rootCheckbox?.props["onChange"] as () => void)();
    expect(onToggle).toHaveBeenCalledWith("todo-1");
    const visBtn = findElements(tree, (el) => el.props["aria-label"] === 'Cambiar visibilidad de "Revisar creatividades" a Compartido con agencia')[0];
    (visBtn?.props["onClick"] as () => void)();
    expect(onChangeVisibility).toHaveBeenCalledWith("workspace");
  });

  it("NoteEditorCard usa Card del bento, Chip de autoguardado y visibilidad, soporte de solo lectura y Button de cambio de visibilidad", () => {
    const onRetrySave = vi.fn();
    const onChangeVisibility = vi.fn();
    const savingHtml = renderToStaticMarkup(createElement(NoteEditorCard, { id: "n1", title: "Ideas", content: "Texto", isPinned: false, isArchived: false, saveStatus: "saving" }));
    const savedHtml = renderToStaticMarkup(createElement(NoteEditorCard, { id: "n1", title: "Ideas", content: "Texto", isPinned: true, isArchived: false, saveStatus: "saved", visibility: "workspace", isReadOnly: true }));
    const errorTree = NoteEditorCard({ id: "n1", title: "Ideas", content: "Texto", isPinned: true, isArchived: false, saveStatus: "error", visibility: "workspace", canChangeVisibility: true, linkedTodos: [{ id: "t1", title: "Subir arte", isDone: false }], onRetrySave, onChangeVisibility });
    const errorHtml = renderToStaticMarkup(errorTree);
    expect(savingHtml).toContain("Guardando…");
    expect(savingHtml).toContain("Privado");
    expect(savedHtml).toContain("Guardado");
    expect(savedHtml).toContain("Compartido con agencia");
    expect(savedHtml).toContain("Solo lectura");
    expect(savedHtml).not.toContain("Crear pendiente desde esta nota");
    expect(savedHtml).toContain('data-slot="card"');
    expect(savedHtml).toContain('data-slot="chip"');
    expect(savedHtml).toContain('data-slot="textfield"');
    expect(savedHtml).toContain('data-slot="textarea"');
    expect(savedHtml).toContain("var(--bento-card-bg)");
    expect(savedHtml).toContain("--status-success-bg");
    expect(errorHtml).toContain("No se pudo guardar · Reintentar");
    expect(errorHtml).toContain("Pasar a privado");
    expect(errorHtml).toContain("--status-danger-bg");
    expect(errorHtml).toContain("Subir arte · Pendiente");
    const retryBtn = findElements(errorTree, (el) => el.props["aria-label"] === "Reintentar guardado de nota")[0];
    (retryBtn?.props["onClick"] as () => void)();
    expect(onRetrySave).toHaveBeenCalledWith("n1");
    const visBtn = findElements(errorTree, (el) => el.props["aria-label"] === "Cambiar visibilidad de la nota a Privado")[0];
    (visBtn?.props["onClick"] as () => void)();
    expect(onChangeVisibility).toHaveBeenCalledWith("private");
  });

  it("ViewSelector usa Tabs, Tabs.List, Tabs.Tab y Chip con estilo de píldoras y cambio de selección", () => {
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
    (tabsRoot?.props["onSelectionChange"] as (key: string) => void)("upcoming");
    expect(onSelectView).toHaveBeenCalledWith("upcoming");
  });

  it("AgencyTeamPanel gestiona selector de espacio, creación de agencia, permisos de roles, salida con exportación e invitaciones (#64, ADR 0007)", () => {
    expect(WORKSPACE_ROLE_LABELS).toEqual({ owner: "Propietario", admin: "Administrador", editor: "Editor", viewer: "Lectura" });
    expect(getAssignableRolesForMember("owner", { userId: "u1", role: "owner", isCurrentUser: true }, 1)).toEqual([]);
    expect(getAssignableRolesForMember("owner", { userId: "u1", role: "owner", isCurrentUser: true }, 2)).toEqual(["owner", "admin", "editor", "viewer"]);
    expect(getAssignableRolesForMember("owner", { userId: "u2", role: "admin" }, 1)).toEqual(["owner", "admin", "editor", "viewer"]);
    expect(getAssignableRolesForMember("admin", { userId: "u2", role: "admin" }, 1)).toEqual([]);
    expect(getAssignableRolesForMember("admin", { userId: "u3", role: "editor" }, 1)).toEqual(["editor", "viewer"]);

    const onCreateAgency = vi.fn();
    const onCreateInvitation = vi.fn();
    const onCopyInviteLink = vi.fn();
    const onRevokeInvitation = vi.fn();
    const onExportPrivateData = vi.fn();
    const tree = AgencyTeamPanel({
      workspaces: [
        { id: "ws-1", name: "Mi Espacio", kind: "personal", role: "owner" },
        { id: "ws-2", name: "Estudio Norte", kind: "agency", role: "owner" },
      ],
      activeWorkspaceId: "ws-2",
      currentUserRole: "owner",
      isTeamSectionOpen: true,
      newAgencyName: "  Agencia Sur  ",
      inviteEmail: "  ana@estudionorte.com ",
      inviteRole: "editor",
      generatedInviteLink: "/invitacion#tok_1234567890abcdef",
      members: [
        { userId: "u1", label: "marcos@estudionorte.com", role: "owner", isCurrentUser: true },
        { userId: "u2", label: "clara@estudionorte.com", role: "editor" },
      ],
      pendingInvitations: [{ id: "inv-1", email: "ana@estudionorte.com", role: "editor", expiresAt: "2026-11-11" }],
      onCreateAgency,
      onCreateInvitation,
      onCopyInviteLink,
      onRevokeInvitation,
      onExportPrivateData,
    });
    const html = renderToStaticMarkup(tree);
    expect(html).toContain("Estudio Norte (Agencia · Propietario)");
    expect(html).toContain("Promueve a otro miembro a Propietario antes de salir");
    expect(html).toContain("/invitacion#tok_1234567890abcdef");
    expect(html).toContain("ana@estudionorte.com · Editor · Vence: 2026-11-11");

    const revokeBtn = findElements(tree, (el) => el.props["aria-label"] === "Revocar invitación de ana@estudionorte.com")[0];
    (revokeBtn?.props["onClick"] as () => void)();
    expect(onRevokeInvitation).toHaveBeenCalledWith("inv-1");
  });

  it("WorkspaceEmptyState usa EmptyState y Button de HeroUI con tokens del bento en las 4 vistas", () => {
    for (const view of ["today", "upcoming", "no_date", "done"] as const) {
      const html = renderToStaticMarkup(createElement(WorkspaceEmptyState, { view, actionLabel: "Capturar", onAction: () => {} }));
      expect(html).toContain(WORKSPACE_EMPTY_MESSAGES[view]);
      expect(html).toContain("var(--bento-card-bg)");
      expect(html).toContain('data-slot="button"');
      expect(html).toContain("/marca/hubi-origen-claro-256.webp");
      expect(html).toContain("/marca/hubi-origen-oscuro-256.webp");
    }
    const symbolHtml = renderToStaticMarkup(createElement(HublySymbol, { size: 28 }));
    const wordmarkHtml = renderToStaticMarkup(createElement(HublyWordmark, { height: 28 }));
    expect(symbolHtml).toContain('role="img"');
    expect(symbolHtml).toContain('aria-label="Hubly"');
    expect(symbolHtml).toContain("var(--accent-primary)");
    expect(renderToStaticMarkup(createElement(HublySymbol, { decorative: true }))).toContain('aria-hidden="true"');
    expect(wordmarkHtml).not.toContain("<text");
    const hexPattern = /#[0-9a-fA-F]{3,8}\b/;
    expect(symbolHtml).not.toMatch(hexPattern);
    expect(wordmarkHtml).not.toMatch(hexPattern);
    const hubiDeco = renderToStaticMarkup(createElement(Hubi, { acabado: "volumen", pose: "laptop", tamano: 96, decorativo: true }));
    expect(hubiDeco).toContain('aria-hidden="true"');
    expect(hubiDeco).toContain('width="96"');
    expect(hubiDeco).toContain('height="96"');
    expect(hubiDeco).toContain("hubly-hubi-light");
    expect(hubiDeco).toContain("hubly-hubi-dark");
  });
});

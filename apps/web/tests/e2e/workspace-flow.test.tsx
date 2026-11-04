import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import {
  createNoteAction,
  createTodoAction,
  createTodoFromNoteAction,
  exportWorkspaceAction,
  listNotesAction,
  listTodosByViewAction,
  saveNoteAction,
  toggleTodoAction,
} from "../../src/actions";
import { HoyPage } from "../../src/app/(workspace)/hoy/page";
import { shouldTriggerQuickCaptureShortcut } from "../../src/components/WorkspaceScreen";
import { DEFAULT_APP_TIMEZONE, ensureAuthenticatedWorkspace, setSupabaseServerClientFactoryForTests } from "../../src/server/composition";

describe("Flujo E2E Completo Fase 1A contra Postgres real en Docker (#28 y #46)", { timeout: 30000 }, () => {
  const userA = { id: crypto.randomUUID(), email: "a@hubly.es" };
  const userB = { id: crypto.randomUUID(), email: "b@hubly.es" };
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: DEFAULT_APP_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

  const actAs = (user: { id: string; email: string } | null) => {
    setSupabaseServerClientFactoryForTests(() => ({
      auth: {
        getUser: vi.fn().mockResolvedValue(
          user ? { data: { user }, error: null } : { data: { user: null }, error: new Error("No session") },
        ),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any);
  };

  afterEach(() => { setSupabaseServerClientFactoryForTests(null); });

  it("ejecuta flujo diario en Hoy en zona horaria local, persiste datos tras recarga completa de HoyPage y verifica aislamiento RLS", async () => {
    // 0. Sin sesión activa cualquier Server Action rechaza con 'Sesión caducada'
    actAs(null);
    await expect(listNotesAction()).rejects.toThrow("Sesión caducada");

    // 1. Primer inicio de sesión de Usuario A: alta automática del espacio personal y carga inicial real desde HoyPage
    actAs(userA);
    const { workspaceId: wsAId } = await ensureAuthenticatedWorkspace(undefined, "Espacio E2E A");
    const initialHtml = renderToStaticMarkup(await HoyPage());
    expect(initialHtml).toContain("No tienes pendientes para hoy");

    // 2. Atajo de teclado 'c' y captura rápida de pendiente en Hoy
    expect(shouldTriggerQuickCaptureShortcut("c", "BODY", false)).toBe(true);
    expect(shouldTriggerQuickCaptureShortcut("c", "INPUT", false)).toBe(false);
    const capturedTodo = await createTodoAction({ title: "Publicar parrilla mensual", priority: "high", dueDate: today });
    const afterCaptureHtml = renderToStaticMarkup(await HoyPage());
    expect(afterCaptureHtml).toContain("Publicar parrilla mensual");

    // 3. Marcado de pendiente como hecho y paso a la vista de Hechos
    const toggledTodo = await toggleTodoAction(capturedTodo.id);
    expect(toggledTodo.isDone).toBe(true);
    expect(toggledTodo.doneAt).toBeTruthy();
    expect(await listTodosByViewAction("today")).toEqual([]);
    const doneTodos = await listTodosByViewAction("done");
    expect(doneTodos.map((t) => t.id)).toEqual([capturedTodo.id]);

    // 4. Creación de nota y autoguardado con control de concurrencia optimista (badge Guardado)
    const createdNote = await createNoteAction({ title: "Minuta cliente Q4", content: "Borrador inicial" });
    expect(createdNote.version).toBe(1);
    const savedNote = await saveNoteAction({ id: createdNote.id, title: "Minuta cliente Q4", content: "Borrador validado y guardado", isPinned: true, expectedVersion: 1 });
    expect(savedNote.version).toBe(2);
    await expect(saveNoteAction({ id: createdNote.id, content: "Versión obsoleta", expectedVersion: 1 })).rejects.toThrow();

    // 5. Captura de un único pendiente ligado a la nota y recarga completa de HoyPage desde Postgres real
    const derivedTodo = await createTodoFromNoteAction(savedNote.id, { title: "Enviar minuta por correo", detail: "Adjuntar métricas", dueDate: today, priority: "medium" });
    expect(derivedTodo.noteId).toBe(savedNote.id);
    const reloadedHtml = renderToStaticMarkup(await HoyPage());
    expect(reloadedHtml).toContain("Guardado");
    expect(reloadedHtml).toContain("Minuta cliente Q4");
    expect(reloadedHtml).toContain("Borrador validado y guardado");
    expect(reloadedHtml).toContain("Nota de origen: Minuta cliente Q4");
    expect(reloadedHtml).toContain("Enviar minuta por correo · Pendiente");

    // 6. Aislamiento multi-inquilino tras recarga con Usuario B: HoyPage de B está vacío y no ve ni altera nada de Usuario A
    actAs(userB);
    const userBReloadedHtml = renderToStaticMarkup(await HoyPage());
    expect(userBReloadedHtml).toContain("No tienes pendientes para hoy");
    expect(userBReloadedHtml).not.toContain("Minuta cliente Q4");
    expect(userBReloadedHtml).not.toContain("Enviar minuta por correo");
    await expect(listNotesAction(undefined, wsAId)).rejects.toThrow("No autorizado en el espacio de trabajo");
    await expect(saveNoteAction({ id: savedNote.id, content: "Intento de B", expectedVersion: 2 }, wsAId)).rejects.toThrow("No autorizado en el espacio de trabajo");
    await expect(toggleTodoAction(derivedTodo.id)).rejects.toThrow();

    // 7. Exportación de datos de Usuario A (Constitución #5): JSON y Markdown contienen exactamente los datos reales sin pérdida
    actAs(userA);
    const exported = await exportWorkspaceAction();
    expect(exported.jsonFilename).toBe(`hubly-export-${today}.json`);
    expect(exported.mdFilename).toBe(`hubly-export-${today}.md`);
    const parsedJson = JSON.parse(exported.jsonContent);
    expect(parsedJson.version).toBe(1);
    expect(parsedJson.notes).toHaveLength(1);
    expect(parsedJson.notes[0]).toMatchObject({ id: savedNote.id, title: "Minuta cliente Q4", content: "Borrador validado y guardado", isPinned: true, isArchived: false, version: 2 });
    expect(parsedJson.todos).toHaveLength(2);
    expect(exported.markdownContent).toContain("## Minuta cliente Q4 [Fijada]");
    expect(exported.markdownContent).toContain(`- [x] [ALTA] Publicar parrilla mensual (Vence: ${today})`);
    expect(exported.markdownContent).toContain(`- [ ] [NORMAL] Enviar minuta por correo (Vence: ${today}) (Nota: ${savedNote.id})\n  Adjuntar métricas`);
  });
});

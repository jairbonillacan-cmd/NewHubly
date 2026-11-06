import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import * as ui from "@hubly/ui";

vi.mock("server-only", () => ({}));
import { createTodoAction, exportWorkspaceAction, loadWorkspaceDashboardAction, saveNoteAction } from "../src/actions";
import { signOutAction } from "../src/actions/auth";
import { HoyPage } from "../src/app/(workspace)/hoy/page";
import {
  TZ_REFRESH_STORAGE_KEY, type ActionErrorState, WorkspaceScreen, classifyTodoItemForView,
  executeProtectedAction, itemPermissions, shouldTriggerQuickCaptureShortcut, syncTimeZoneAndMaybeRefresh,
} from "../src/components/WorkspaceScreen";
import { createSystemClock, isValidIanaTimeZone, setClockNowForTests, setSupabaseServerClientFactoryForTests, setTimeZoneResolverForTests, setWorkspaceDbForTests } from "../src/server/composition";

describe("Pantalla Hoy conectada a Server Actions, zona horaria local, errores recuperables y HeroUI (#27 y #46)", () => {
  afterEach(() => {
    setSupabaseServerClientFactoryForTests(null); setWorkspaceDbForTests(undefined);
    setTimeZoneResolverForTests(null); setClockNowForTests(null);
  });

  const setupMockDb = (instant: Date) => {
    const nameOf = (t: unknown) => (t as { [k: symbol]: string })?.[Symbol.for("drizzle:Name")];
    const tx = {
      execute: vi.fn().mockResolvedValue([]),
      select: vi.fn().mockImplementation(() => ({
        from: (table: unknown) => ({
          where: () => {
            const n = nameOf(table);
            const rows = n === "notes"
              ? [{ id: "n-1", workspaceId: "w-1", createdBy: "u-1", title: "Estrategia Q4", content: "Objetivos", isPinned: true, isArchived: false, version: 2, createdAt: instant, updatedAt: instant }]
              : n === "todos"
                ? [{ id: "t-1", workspaceId: "w-1", createdBy: "u-1", noteId: "n-1", title: "Revisar presupuesto", detail: "Hoy local", dueDate: "2026-11-03", priority: "high", isDone: false, doneAt: null, createdAt: instant, updatedAt: instant }]
                : [{ workspaceId: "w-1", userId: "u-1", role: "owner", createdAt: instant }];
            return { limit: async (c: number) => rows.slice(0, c), orderBy: async () => rows };
          },
        }),
      })),
    };
    const getUserSpy = vi.fn().mockResolvedValue({ data: { user: { id: "u-1", email: "ana@agencia.es" } }, error: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setWorkspaceDbForTests({ transaction: vi.fn().mockImplementation((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)) } as any);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setSupabaseServerClientFactoryForTests(() => ({ auth: { getUser: getUserSpy } }) as any);
    return getUserSpy;
  };

  it("renderiza los 4 estados obligatorios de pantalla terminada (carga, sin sesión, error y listo/vacío), conteos HeroUI y botón Cerrar sesión", async () => {
    expect(renderToStaticMarkup(<WorkspaceScreen initialStatus="loading" />)).toContain("Cargando tu espacio de trabajo…");
    expect(renderToStaticMarkup(<WorkspaceScreen initialStatus="unauthenticated" />)).toContain("Volver a iniciar sesión");
    const errorHtml = renderToStaticMarkup(<WorkspaceScreen initialStatus="error" errorMessage="Fallo de red" />);
    expect(errorHtml).toContain("Reintentar");
    expect(errorHtml).toContain("/marca/hubi-volumen-reparar-claro-256.webp");
    expect(errorHtml).toContain("/marca/hubi-volumen-reparar-oscuro-256.webp");
    const emptyHtml = renderToStaticMarkup(<WorkspaceScreen initialStatus="ready" todayDate="2026-11-04" />);
    // Espacio con paneles de cristal (#75): exportar y cerrar sesión viven en el menú de cuenta, que se abre al pulsarlo.
    expect(emptyHtml).toContain("No tienes pendientes para hoy.");
    expect(emptyHtml).toContain('aria-label="Menú de tu cuenta"');
    expect(emptyHtml).toContain("Buscar o ejecutar");
    expect(emptyHtml).toContain("Capturar pendiente");
    expect(emptyHtml).toContain("Nueva nota");
    expect(emptyHtml).toContain("0 vencidos");
    expect(emptyHtml).toContain("0 para hoy");
    expect(emptyHtml).toContain("Todo guardado");

    const signOutSpy = vi.fn().mockResolvedValue({ error: null });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setSupabaseServerClientFactoryForTests(() => ({ auth: { signOut: signOutSpy } }) as any);
    expect(await signOutAction()).toEqual({ ok: true });
    expect(signOutSpy).toHaveBeenCalledTimes(1);
  });

  it("calcula Hoy en America/Mexico_City a las 19:00 local (2026-11-04T01:00:00Z = 2026-11-03 local) y limita recarga por zona horaria a un intento por sesión", async () => {
    expect(isValidIanaTimeZone("America/Mexico_City")).toBe(true);
    expect(isValidIanaTimeZone("Zona/Invalida")).toBe(false);
    const instant = new Date("2026-11-04T01:00:00.000Z");
    setClockNowForTests(() => instant);
    setTimeZoneResolverForTests(() => "America/Mexico_City");
    expect(createSystemClock("America/Mexico_City").todayIsoDate()).toBe("2026-11-03");
    const getUserSpy = setupMockDb(instant);

    const dashboard = await loadWorkspaceDashboardAction("w-1");
    expect(getUserSpy).toHaveBeenCalledTimes(1);
    expect(dashboard.todayDate).toBe("2026-11-03");
    expect(dashboard.timezone).toBe("America/Mexico_City");

    const html = renderToStaticMarkup(await HoyPage());
    // El pendiente con fecha del día local (3 nov) cae en «Hoy» y no en «Vencidos».
    expect(html).toContain("3 de noviembre");
    expect(html).toContain("Hoy · 1");
    expect(html).not.toContain("Vencidos ·");
    expect(html).toContain("1 para hoy");
    expect(html).toContain("Nota de origen: Estrategia Q4");
    expect(html).toContain("Revisar presupuesto · Pendiente");

    const store = new Map<string, string>();
    const storage = { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => { store.set(k, v); } };
    const onRefresh = vi.fn();
    expect(syncTimeZoneAndMaybeRefresh("Europe/Madrid", "America/Mexico_City", storage, onRefresh)).toBe(true);
    expect(store.get(TZ_REFRESH_STORAGE_KEY)).toBe("Europe/Madrid");
    expect(syncTimeZoneAndMaybeRefresh("Europe/Madrid", "America/Mexico_City", storage, onRefresh)).toBe(false);
    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it("muestra aviso con botón Reintentar (sin onClick duplicado), re-ejecuta la acción una sola vez al pulsarlo y redirige a /login ante Sesión caducada", async () => {
    let currentError: ActionErrorState | null = null;
    const onExpired = vi.fn();
    const flakyAction = vi.fn().mockRejectedValueOnce(new Error("Fallo temporal al marcar pendiente")).mockResolvedValueOnce(undefined);
    await executeProtectedAction("No se pudo actualizar.", flakyAction, onExpired, (st) => { currentError = st; });
    expect(onExpired).not.toHaveBeenCalled();
    expect(flakyAction).toHaveBeenCalledTimes(1);
    const alertHtml = renderToStaticMarkup(<WorkspaceScreen todayDate="2026-11-03" initialActionError={currentError} />);
    expect(alertHtml).toContain("Fallo temporal al marcar pendiente");
    expect(alertHtml).toContain("Reintentar");
    await currentError!.retry();
    expect(flakyAction).toHaveBeenCalledTimes(2);
    expect(currentError).toBeNull();
    await executeProtectedAction("Error", async () => { throw new Error("Sesión caducada"); }, onExpired, (st) => { currentError = st; });
    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(currentError).toBeNull();
    // En producción Next oculta el mensaje y añade «digest»: se muestra el mensaje propio de la acción, en español (#92).
    const sanitized = Object.assign(new Error("An error occurred in the Server Components render."), { digest: "1234567" });
    await executeProtectedAction("No se pudo guardar la nota.", async () => { throw sanitized; }, onExpired, (st) => { currentError = st; });
    expect(currentError!.message).toBe("No se pudo guardar la nota.");
    // La redirección de una Server Action es la sesión caducada, no un error que mostrar (revisión de #94).
    const redirectToLogin = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;replace;/login;307;" });
    await executeProtectedAction("No se pudo guardar la nota.", async () => { throw redirectToLogin; }, onExpired, (st) => { currentError = st; });
    expect(onExpired).toHaveBeenCalledTimes(2);
    expect(currentError).toBeNull();
    // Cualquier NEXT_REDIRECT se trata igual, también si la ruta no es /login.
    const redirectElsewhere = Object.assign(new Error("NEXT_REDIRECT"), { digest: "NEXT_REDIRECT;push;/hoy;307;" });
    await executeProtectedAction("No se pudo guardar la nota.", async () => { throw redirectElsewhere; }, onExpired, (st) => { currentError = st; });
    expect(onExpired).toHaveBeenCalledTimes(3);
    expect(currentError).toBeNull();
  });

  it("evalúa atajos globales 'c' y '/', clasifica vistas y valida Server Actions con fecha de exportación local", async () => {
    expect(shouldTriggerQuickCaptureShortcut("c", "DIV", false)).toBe(true);
    expect(shouldTriggerQuickCaptureShortcut("/", "BODY", false)).toBe(true);
    expect(shouldTriggerQuickCaptureShortcut("c", "INPUT", false)).toBe(false);
    const base = { id: "1", workspaceId: "w", createdBy: "u", noteId: null, title: "T", detail: "", priority: "medium" as const, isDone: false, doneAt: null, createdAt: "", updatedAt: "" };
    expect(classifyTodoItemForView({ ...base, dueDate: "2026-11-02" }, "2026-11-03")).toBe("today");
    expect(classifyTodoItemForView({ ...base, dueDate: "2026-11-05" }, "2026-11-03")).toBe("upcoming");
    expect(classifyTodoItemForView({ ...base, dueDate: null }, "2026-11-03")).toBe("no_date");
    expect(classifyTodoItemForView({ ...base, isDone: true }, "2026-11-03")).toBe("done");

    const instant = new Date("2026-11-04T01:00:00.000Z");
    setClockNowForTests(() => instant);
    setTimeZoneResolverForTests(() => "America/Mexico_City");
    setupMockDb(instant);

    await expect(saveNoteAction({ id: "n-1", content: "Sin versión" }, "w-1")).rejects.toThrow();
    await expect(createTodoAction({ title: "   " }, "w-1")).rejects.toThrow("El título es obligatorio");
    const exp = await exportWorkspaceAction("w-1");
    expect(exp.jsonFilename).toBe("hubly-export-2026-11-03.json");
    expect(exp.mdFilename).toBe("hubly-export-2026-11-03.md");
    expect(exp.markdownContent).toContain("## Estrategia Q4 [Fijada]");
  });
});

describe("Agencias en Hoy: permisos de interfaz por elemento (#64, #78)", () => {
  const agency = { id: "ag-1", name: "Agencia Pulso", slug: "pulso", kind: "agency" as const, role: "viewer" as const };
  it("solo el autor con rol distinto de lectura cambia la visibilidad; el lector no edita lo ajeno", () => {
    expect(itemPermissions(undefined, "u1", "u1")).toEqual({});
    expect(itemPermissions({ ...agency, kind: "personal" }, "u1", "u1")).toEqual({});
    expect(itemPermissions({ ...agency, role: "editor" }, "u1", "u1")).toEqual({ canChangeVisibility: true, readOnly: false });
    expect(itemPermissions({ ...agency, role: "editor" }, "u1", "u2")).toEqual({ canChangeVisibility: false, readOnly: false });
    expect(itemPermissions(agency, "u1", "u1")).toEqual({ canChangeVisibility: false, readOnly: false });
    expect(itemPermissions(agency, "u1", "u2")).toEqual({ canChangeVisibility: false, readOnly: true });
    // Sin usuario conocido, falla cerrado (observación 5 de la revisión de #86).
    expect(itemPermissions({ ...agency, role: "owner" }, "", "u2")).toEqual({ canChangeVisibility: false, readOnly: false });
  });

  it("pinta la agencia activa y la lista de espacios que llega del servidor", () => {
    using espacio = vi.spyOn(ui, "EspacioHoy");
    const personal = { id: "p-1", name: "Mi Espacio", slug: "mi-espacio", kind: "personal" as const, role: "owner" as const };
    const html = renderToStaticMarkup(
      <WorkspaceScreen todayDate="2026-11-05" currentUserId="u1" initialActiveWorkspace={agency}
        initialWorkspaces={[personal, agency]} />,
    );
    expect(html).toContain("Cambiar de espacio (actual: Agencia Pulso)");
    expect(espacio.mock.calls[0]?.[0]).toMatchObject({
      activeWorkspace: { id: agency.id, name: agency.name },
      workspaces: [{ id: personal.id, kind: "personal" }, { id: agency.id, kind: "agency" }],
    });
  });
});

import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import nextConfig from "../next.config";
import { createTodoAction, exportWorkspaceAction, loadWorkspaceDashboardAction, saveNoteAction } from "../src/actions";
import { signOutAction } from "../src/actions/auth";
import { InvitacionPage, consumeInvitationHashToken } from "../src/app/(public)/invitacion/page";
import { HoyPage } from "../src/app/(workspace)/hoy/page";
import {
  TZ_REFRESH_STORAGE_KEY, type ActionErrorState, WorkspaceScreen, classifyTodoItemForView,
  executeProtectedAction, shouldTriggerQuickCaptureShortcut, syncTimeZoneAndMaybeRefresh,
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
        from: (table: unknown) => {
          const n = nameOf(table);
          const rows = n === "notes"
            ? [{ id: "n-1", workspaceId: "w-1", createdBy: "u-1", title: "Estrategia Q4", content: "Objetivos", isPinned: true, isArchived: false, visibility: "private", version: 2, createdAt: instant, updatedAt: instant }]
            : n === "todos"
              ? [{ id: "t-1", workspaceId: "w-1", createdBy: "u-1", noteId: "n-1", title: "Revisar presupuesto", detail: "Hoy local", dueDate: "2026-11-03", priority: "high", visibility: "private", isDone: false, doneAt: null, createdAt: instant, updatedAt: instant }]
              : n === "workspaces"
                ? [{ id: "w-1", name: "Mi Espacio", slug: "mi-espacio", kind: "personal", role: "owner", createdAt: instant }]
                : [{ workspaceId: "w-1", userId: "u-1", role: "owner", createdAt: instant }];
          const res = { limit: async (c: number) => rows.slice(0, c), orderBy: async () => rows };
          return { where: () => res, innerJoin: () => ({ where: () => res }) };
        },
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
    expect(renderToStaticMarkup(<WorkspaceScreen initialStatus="error" errorMessage="Fallo de red" />)).toContain("Reintentar");
    const emptyHtml = renderToStaticMarkup(<WorkspaceScreen initialStatus="ready" todayDate="2026-11-04" />);
    expect(emptyHtml).toContain("No tienes pendientes para hoy. Escribe arriba para capturar el primero o revisa Sin fecha.");
    expect(emptyHtml).toContain("Exportar JSON");
    expect(emptyHtml).toContain("Exportar Markdown");
    expect(emptyHtml).toContain("Cerrar sesión");
    expect(emptyHtml).toContain("Nueva nota");

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
    expect(html).toContain("Espacio personal · 2026-11-03");
    expect(html).toContain("Hoy · 2026-11-03");
    expect(html).not.toContain("Vencido · 2026-11-03");
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

  it("configura Referrer-Policy: no-referrer en /invitacion, limpia el fragmento URL con replaceState y renderiza panel de agencia y visibilidad en /hoy (#64)", async () => {
    const headers = await nextConfig.headers!();
    expect(headers).toEqual(expect.arrayContaining([
      { source: "/invitacion", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] },
    ]));
    const replaceState = vi.fn();
    expect(consumeInvitationHashToken({ hash: "#tok_secreto_1234567890" }, { replaceState })).toBe("tok_secreto_1234567890");
    expect(replaceState).toHaveBeenCalledWith(null, "", "/invitacion");
    expect(renderToStaticMarkup(<InvitacionPage initialToken={"a".repeat(24)} />)).toContain("Aceptar invitación a la agencia");
    expect(renderToStaticMarkup(<InvitacionPage initialError="El correo no coincide" />)).toContain("El correo no coincide");

    const agencyHtml = renderToStaticMarkup(
      <WorkspaceScreen
        todayDate="2026-11-04" currentUserId="u-1"
        initialActiveWorkspace={{ id: "ws-ag", name: "Estudio Norte", slug: "estudio-norte", kind: "agency", role: "owner" }}
        initialMembers={[{ workspaceId: "ws-ag", userId: "u-1", role: "owner", createdAt: "2026-11-04T00:00:00.000Z" }]}
        initialNotes={[{ id: "n-1", workspaceId: "ws-ag", createdBy: "u-1", title: "Pauta Compartida", content: "Guion", isPinned: true, isArchived: false, visibility: "workspace", version: 1, createdAt: "", updatedAt: "" }]}
      />,
    );
    expect(agencyHtml).toContain("Agencia: Estudio Norte · 2026-11-04");
    expect(agencyHtml).toContain("Compartido con agencia");
    expect(agencyHtml).toContain("Pasar a privado");
  });
});

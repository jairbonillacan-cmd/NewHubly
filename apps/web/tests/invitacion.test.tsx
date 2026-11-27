import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import nextConfig from "../next.config";
import { InvitacionScreen, consumeInvitationHashToken } from "../src/components/InvitacionScreen";
import { NextRequest } from "next/server";
import { middleware } from "../src/middleware";
import {
  acceptWorkspaceInvitationByToken, acceptWorkspaceInvitationSafely, classifyInvitationError,
  resolveActiveWorkspaceCookie, setSupabaseServerClientFactoryForTests,
} from "../src/server/composition";

describe("Página /invitacion (#64; revisión de #86, puntos 2 y 3)", () => {
  it("quita el token del fragmento y del historial, y no envía Referer", async () => {
    const replaceState = vi.fn();
    expect(consumeInvitationHashToken({ hash: "#tok_secreto_1234567890" }, { replaceState })).toBe("tok_secreto_1234567890");
    expect(replaceState).toHaveBeenCalledWith(null, "", "/invitacion");
    expect(consumeInvitationHashToken({ hash: "" }, { replaceState })).toBe("");
    expect(replaceState).toHaveBeenCalledTimes(1);
    const headers = await nextConfig.headers?.();
    expect(headers).toContainEqual({ source: "/invitacion", headers: [{ key: "Referrer-Policy", value: "no-referrer" }] });
  });

  it("sin sesión explica qué hacer en vez de ofrecer aceptar; con sesión muestra la cuenta", () => {
    const sinSesion = renderToStaticMarkup(<InvitacionScreen sessionEmail={null} initialToken={"a".repeat(43)} />);
    expect(sinSesion).toContain("inicia sesión con el correo al que llegó la invitación");
    expect(sinSesion).not.toContain("Aceptar invitación");
    const conSesion = renderToStaticMarkup(<InvitacionScreen sessionEmail="ana@estudio.mx" initialToken={"a".repeat(43)} />);
    expect(conSesion).toContain("Aceptar invitación");
    expect(conSesion).toContain("ana@estudio.mx");
    expect(renderToStaticMarkup(<InvitacionScreen sessionEmail="ana@estudio.mx" />)).toContain("Falta el enlace de invitación");
  });

  it("clasifica los fallos con códigos estables, sin depender del texto que oculta Next.js en producción", () => {
    expect(classifyInvitationError(new Error("Sesión caducada"))).toBe("SIN_SESION");
    expect(classifyInvitationError(Object.assign(new Error("El correo verificado de tu cuenta no coincide"), { code: "42501" }))).toBe("CORREO_NO_COINCIDE");
    expect(classifyInvitationError(Object.assign(new Error("Usuario no autenticado"), { code: "42501" }))).toBe("SIN_SESION");
    expect(classifyInvitationError(Object.assign(new Error("x"), { code: "22023" }))).toBe("INVALIDA");
    expect(classifyInvitationError(Object.assign(new Error("x"), { code: "23505" }))).toBe("YA_MIEMBRO");
    expect(classifyInvitationError({ name: "ZodError", message: "token" })).toBe("INVALIDA");
    expect(classifyInvitationError(new Error("conexión perdida"))).toBe("ERROR");
  });

  it("el middleware refresca la sesión en /invitacion y no la redirige a /login", async () => {
    const getUser = vi.fn().mockResolvedValue({ data: { user: null }, error: new Error("Expired") });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setSupabaseServerClientFactoryForTests(() => ({ auth: { getUser } }) as any);
    const res = await middleware(new NextRequest("http://localhost:3100/invitacion"));
    expect(getUser).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
    setSupabaseServerClientFactoryForTests(null);
  });

  it("acceptWorkspaceInvitationByToken aprovisiona el espacio personal si no existe y rechaza tokens no-string como INVALIDA (issue 293)", async () => {
    const executedSql: string[] = [];
    const nameOf = (t: unknown) => (t as { [k: symbol]: string })?.[Symbol.for("drizzle:Name")];
    const tx = {
      execute: vi.fn().mockImplementation(async (query?: unknown) => {
        const text = JSON.stringify(query ?? "");
        executedSql.push(text);
        if (text.includes("accept_workspace_invitation")) return [{ workspace_id: "ag-invitada" }];
        if (text.includes("w.kind = 'personal'")) return [];
        if (text.includes("create_personal_workspace")) return [{ id: "ws-personal-nuevo" }];
        return [];
      }),
      select: vi.fn().mockImplementation(() => ({
        from: (table: unknown) => ({
          where: () => ({
            limit: async () => (nameOf(table) === "workspaces"
              ? [{ id: "ag-invitada", kind: "agency" }]
              : [{ workspaceId: "ag-invitada", userId: "u-inv", role: "editor" }]),
          }),
        }),
      })),
    };
    const fakeDb = { transaction: vi.fn().mockImplementation((cb: (t: typeof tx) => Promise<unknown>) => cb(tx)) };
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setSupabaseServerClientFactoryForTests(() => ({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u-inv", email: "inv@agencia.es" } }, error: null }) } }) as any);

    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await acceptWorkspaceInvitationByToken(`/invitacion#${"a".repeat(32)}`, fakeDb as any);
      expect(result).toEqual({ workspaceId: "ag-invitada" });
      expect(await resolveActiveWorkspaceCookie()).toBe("ag-invitada");
      expect(executedSql.some((q) => q.includes("accept_workspace_invitation"))).toBe(true);
      expect(executedSql.some((q) => q.includes("create_personal_workspace"))).toBe(true);

      // Token no-string devuelve INVALIDA sin lanzar TypeError antes de Zod.
      expect(await acceptWorkspaceInvitationSafely(123 as unknown as string)).toMatchObject({ ok: false, code: "INVALIDA" });
    } finally {
      setSupabaseServerClientFactoryForTests(null);
    }
  });
});

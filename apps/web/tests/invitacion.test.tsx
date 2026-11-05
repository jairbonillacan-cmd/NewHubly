import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import nextConfig from "../next.config";
import { InvitacionScreen, consumeInvitationHashToken } from "../src/components/InvitacionScreen";
import { classifyInvitationError } from "../src/server/composition";

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
});

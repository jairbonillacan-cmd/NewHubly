import { HERRAMIENTAS, herramientaDeRuta, herramientaHref } from "@hubly/ui";
import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { middleware } from "../src/middleware";
import { setSupabaseServerClientFactoryForTests } from "../src/server/composition";
import { TOOL_PATHS, cleanLegacyUrl } from "../src/server/composition/clean-urls";

const workspace = "10AA8F3D-11E9-46B3-8E1E-99F5B269BB78";
const signedIn = () =>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setSupabaseServerClientFactoryForTests(() => ({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: { id: "u-1" } }, error: null }) } }) as any);

describe("URL limpias, sin datos internos", () => {
  afterEach(() => setSupabaseServerClientFactoryForTests(null));

  it("cada herramienta del carril tiene su ruta y el middleware la conoce", () => {
    expect([...TOOL_PATHS].sort()).toEqual(HERRAMIENTAS.map((h) => herramientaHref(h.id)).sort());
    expect(herramientaDeRuta("/calendario")).toBe("calendario");
    expect(herramientaDeRuta("/chat")).toBe("hoy");
  });

  it("deja igual una URL ya limpia", () => {
    expect(cleanLegacyUrl(new URL("http://localhost:3100/inicio"))).toBeNull();
    expect(cleanLegacyUrl(new URL("http://localhost:3100/inicio?bienvenida=1"))).toBeNull();
  });

  it("la ruta anterior /hoy lleva a /inicio sin perder la bienvenida ni la herramienta", () => {
    const go = (path: string) => cleanLegacyUrl(new URL(`http://localhost:3100${path}`))?.target;
    expect(go("/hoy")?.pathname).toBe("/inicio");
    expect(go("/hoy?bienvenida=1")?.href).toBe("http://localhost:3100/inicio?bienvenida=1");
    expect(go("/hoy?herramienta=calendario")?.pathname).toBe("/calendario");
  });

  it("lleva los enlaces viejos a su ruta limpia y guarda el espacio en la cookie", async () => {
    signedIn();
    const cases: Array<[string, string]> = [
      [`/chat?workspaceId=${workspace}&vista=sin-leer`, "/chat/sin-leer"],
      [`/chat?workspaceId=${workspace}`, "/chat"],
      [`/hoy?workspaceId=${workspace}&herramienta=calendario`, "/calendario"],
      ["/hoy?herramienta=desconocida", "/inicio"],
    ];
    for (const [from, to] of cases) {
      const res = await middleware(new NextRequest(`http://localhost:3100${from}`));
      expect(res.status).toBe(307);
      expect(res.headers.get("location")).toBe(`http://localhost:3100${to}`);
    }
    const res = await middleware(new NextRequest(`http://localhost:3100/chat?workspaceId=${workspace}`));
    expect(res.cookies.get("hubly_ws")?.value).toBe(workspace.toLowerCase());
    expect(res.cookies.get("hubly_ws")?.httpOnly).toBe(true);
  });

  it("no guarda en la cookie un espacio que no sea un UUID", async () => {
    signedIn();
    const res = await middleware(new NextRequest("http://localhost:3100/inicio?workspaceId=no-es-uuid"));
    expect(res.headers.get("location")).toBe("http://localhost:3100/inicio");
    expect(res.cookies.get("hubly_ws")).toBeUndefined();
  });

  it("«Crear cuenta» vive en /registro; sin sesión se muestra, con sesión lleva a Hoy", async () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    setSupabaseServerClientFactoryForTests(() => ({ auth: { getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: new Error("No session") }) } }) as any);
    const legacy = await middleware(new NextRequest("http://localhost:3100/login?modo=registro"));
    expect(legacy.headers.get("location")).toBe("http://localhost:3100/registro");
    expect((await middleware(new NextRequest("http://localhost:3100/registro"))).status).toBe(200);
    const tool = await middleware(new NextRequest("http://localhost:3100/calendario"));
    expect(tool.headers.get("location")).toBe("http://localhost:3100/login");
    signedIn();
    expect((await middleware(new NextRequest("http://localhost:3100/registro"))).headers.get("location")).toBe("http://localhost:3100/inicio");
  });
});

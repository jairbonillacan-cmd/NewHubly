import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
let messageRetired = false;
const storedRows: Array<{ id: string; message_id: string; object_path: string; file_name: string; mime_type: string; byte_size: number; width: number | null; height: number | null }> = [];
vi.mock("@hubly/db", () => ({
  sql: () => ({}),
  withUserContext: async (_claims: unknown, fn: (tx: { execute: (q: unknown) => Promise<unknown[]> }) => Promise<unknown>) =>
    fn({ execute: async () => (messageRetired ? [] : storedRows.length > 0 ? storedRows : [{ id: "33333333-3333-4333-8333-333333333333" }]) }),
}));
import { GET, POST } from "../src/app/api/chat/attachments/route";
import { setSupabaseServerClientFactoryForTests } from "../src/server/composition/auth";
import { CHAT_ATTACHMENT_MAX_BYTES, sanitizeChatAttachment } from "../src/server/composition/chat-attachments";

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n; for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0;
});
const crc32 = (buf: Uint8Array) => {
  let c = 0xffffffff; for (const b of buf) c = crcTable[(c ^ b) & 0xff]! ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0;
};
const pngChunk = (type: string, data: Uint8Array) => {
  const out = new Uint8Array(12 + data.length), view = new DataView(out.buffer);
  view.setUint32(0, data.length);
  for (let i = 0; i < 4; i += 1) out[4 + i] = type.charCodeAt(i);
  out.set(data, 8); view.setUint32(8 + data.length, crc32(out.subarray(4, 8 + data.length)));
  return out;
};
const makePng = (w = 16, h = 12, withText = false) => {
  const ihdr = new Uint8Array(13), v = new DataView(ihdr.buffer);
  v.setUint32(0, w); v.setUint32(4, h); ihdr[8] = 8; ihdr[9] = 2;
  const parts = [new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pngChunk("IHDR", ihdr)];
  if (withText) parts.push(pngChunk("tEXt", new TextEncoder().encode("Author\0Secreto")));
  parts.push(pngChunk("IDAT", new Uint8Array([0x78, 0x9c, 0x63, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01])), pngChunk("IEND", new Uint8Array(0)));
  const total = new Uint8Array(parts.reduce((s, p) => s + p.length, 0));
  let off = 0; for (const p of parts) { total.set(p, off); off += p.length; }
  return total;
};
const makeGif = () => new Uint8Array([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x08, 0x00, 0x06, 0x00, 0x00, 0x00, 0x00,
  0x21, 0xfe, 0x04, 0x47, 0x50, 0x53, 0x21, 0x00,
  0x2c, 0x00, 0x00, 0x00, 0x00, 0x08, 0x00, 0x06, 0x00, 0x00, 0x02, 0x02, 0x4c, 0x01, 0x00, 0x3b,
]);
const makePdf = (extra = "") => new TextEncoder().encode(`%PDF-1.7\n1 0 obj\n<< /Type /Catalog ${extra} >>\nendobj\n%%EOF\n`);
const multipartRequest = (form: FormData, origin = "http://localhost:3100"): Request =>
  Object.assign(new Request("http://localhost:3100/api/chat/attachments", { method: "POST", headers: { origin, "content-type": "multipart/form-data; boundary=hubly" } }), { formData: async () => form });

describe("Adjuntos de chat: firma binaria, limpieza, 10 MB y ruta privada (Issue 205, ADR 0012)", () => {
  afterEach(() => { setSupabaseServerClientFactoryForTests(null); storedRows.length = 0; messageRetired = false; });

  it("valida firma binaria real, limpia metadatos, extrae dimensiones y rechaza tipos falsificados o > 10 MB", () => {
    const cleanPng = sanitizeChatAttachment(makePng(24, 18, true), "../captura.png");
    expect(cleanPng).toMatchObject({ mimeType: "image/png", fileName: "captura.png", width: 24, height: 18 });
    expect(new TextDecoder().decode(cleanPng.bytes)).not.toContain("Secreto");
    const cleanGif = sanitizeChatAttachment(makeGif(), "anim.gif");
    expect(cleanGif).toMatchObject({ mimeType: "image/gif", width: 8, height: 6 });
    expect(new TextDecoder().decode(cleanGif.bytes)).not.toContain("GPS!");
    expect(sanitizeChatAttachment(makePdf(), "informe.pdf")).toMatchObject({ mimeType: "application/pdf", width: null, height: null });
    expect(() => sanitizeChatAttachment(new TextEncoder().encode("<svg><script>alert(1)</script></svg>"), "falso.png")).toThrow();
    expect(() => sanitizeChatAttachment(makePdf("/JS (app.alert(1))"), "malicioso.pdf")).toThrow(/scripts/i);
    expect(() => sanitizeChatAttachment(new Uint8Array(CHAT_ATTACHMENT_MAX_BYTES + 1), "enorme.png")).toThrow(/10 MB/);
  });

  it("sube y firma por 1h con Content-Disposition attachment, exige mismo origen/tope 5 y oculta al retirar", async () => {
    const wsId = "11111111-1111-4111-8111-111111111111", convId = "22222222-2222-4222-8222-222222222222", msgId = "33333333-3333-4333-8333-333333333333";
    process.env.HUBLY_CHAT_PILOT_WORKSPACE_IDS = wsId;
    setSupabaseServerClientFactoryForTests(() => ({
      auth: { getUser: async () => ({ data: { user: { id: wsId, email: "ana@test.local" } }, error: null }) },
      storage: {
        from: () => ({
          upload: async (path: string) => {
            storedRows.push({ id: path.split("/")[2]!, message_id: msgId, object_path: path, file_name: "plano.png", mime_type: "image/png", byte_size: 80, width: 16, height: 12 });
            return { data: { path }, error: null };
          },
          remove: async () => ({ data: [], error: null }),
          createSignedUrl: async (p: string, s: number, opts?: { download?: string | boolean }) => ({
            data: { signedUrl: `https://storage.test/${p}?exp=${s}${opts?.download ? `&download=${encodeURIComponent(String(opts.download))}` : ""}` }, error: null,
          }),
        }),
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    }) as any);

    expect((await POST(multipartRequest(new FormData(), "https://evil.example"))).status).toBe(403);
    const form = new FormData();
    form.set("workspaceId", wsId); form.set("conversationId", convId); form.set("messageId", msgId);
    form.append("files", new File([makePng(16, 12, true)], "plano.png", { type: "image/png" }));
    const postRes = await POST(multipartRequest(form));
    expect(postRes.status).toBe(200);
    const body = (await postRes.json()) as { attachments: Array<{ url: string; downloadUrl: string; width: number; height: number }> };
    expect(body.attachments[0]).toMatchObject({ width: 16, height: 12 });
    expect(body.attachments[0]?.url).toContain("exp=3600");
    expect(body.attachments[0]?.downloadUrl).toContain("download=plano.png");
    expect((await GET(new Request(`http://localhost:3100/api/chat/attachments?workspaceId=${wsId}&conversationId=${convId}&messageId=${msgId}`))).status).toBe(200);
    messageRetired = true;
    expect((await GET(new Request(`http://localhost:3100/api/chat/attachments?workspaceId=${wsId}&conversationId=${convId}&messageId=${msgId}`))).status).toBe(404);
  });
});

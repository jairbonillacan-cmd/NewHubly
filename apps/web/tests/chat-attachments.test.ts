import { afterEach, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
let messageRetired = false;
let purgeDenied = false;
const expiredPaths: string[] = [];
const calls: string[] = [];
const commandSpy = vi.fn(async (input: { conversationId: string }) => { calls.push("command"); return { conversationId: input.conversationId }; });
vi.mock("../src/server/composition/chat", () => ({
  isChatEnabled: (id: string) => (process.env.HUBLY_CHAT_PILOT_WORKSPACE_IDS ?? "").split(",").includes(id),
  getChatService: async () => ({ command: commandSpy }),
}));
const storedRows: Array<{ id: string; message_id: string; object_path: string; file_name: string; mime_type: string; byte_size: number; width: number | null; height: number | null }> = [];
const reservedRows = new Map<string, { id: string; file_name: string; mime_type: string; byte_size: number; quarantine_path: string; final_path: string }>();
const bucketFiles = new Map<string, Uint8Array>();

vi.mock("@hubly/db", () => ({
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ text: strings.join("?"), values }),
  withUserContext: async (_claims: unknown, fn: (tx: { execute: (q: { text?: string; values?: unknown[] }) => Promise<unknown[]> }) => Promise<unknown>) =>
    fn({
      execute: async (q) => {
        const text = q?.text ?? "";
        const vals = q?.values ?? [];
        if (text.includes("chat_expired_reservation_paths")) return expiredPaths.map((object_path) => ({ object_path }));
        if (text.includes("chat_message_attachment_paths")) {
          if (purgeDenied) throw Object.assign(new Error("denegado"), { code: "42501" });
          return storedRows.flatMap((r) => [
            { object_path: r.object_path, required: true },
            { object_path: r.object_path.replace(/\/([^/]+)$/, "/quarantine/$1"), required: false },
          ]);
        }
        if (text.includes("chat_reserve_attachment_upload")) {
          const [wsId, convId, , fileName, mimeType, byteSize] = vals as [string, string, string, string, string, number];
          const id = `44444444-4444-4444-8444-${String(reservedRows.size + 1).padStart(12, "0")}`;
          const row = { id, file_name: fileName, mime_type: mimeType, byte_size: byteSize, quarantine_path: `${wsId}/${convId}/quarantine/${id}`, final_path: `${wsId}/${convId}/${id}` };
          reservedRows.set(id, row);
          return [row];
        }
        if (text.includes("from private.chat_attachment_reservations")) {
          const id = String(vals[0] ?? "");
          const row = reservedRows.get(id);
          return row ? [row] : [];
        }
        if (text.includes("chat_register_attachment")) {
          const [wsId, convId, msgId, id, fileName, mimeType, byteSize, width, height] = vals as [string, string, string, string, string, string, number, number | null, number | null];
          reservedRows.delete(id);
          storedRows.push({ id, message_id: msgId, object_path: `${wsId}/${convId}/${id}`, file_name: fileName, mime_type: mimeType, byte_size: byteSize, width, height });
          return [{ id }];
        }
        if (messageRetired) return [];
        return storedRows.length > 0 ? storedRows : [{ id: "33333333-3333-4333-8333-333333333333" }];
      },
    }),
}));
import { GET, POST } from "../src/app/api/chat/attachments/route";
import { POST as chatPOST } from "../src/app/api/chat/route";
import { setSupabaseServerClientFactoryForTests } from "../src/server/composition/auth";
import { CHAT_ATTACHMENT_MAX_BYTES, purgeMessageAttachmentsFromStorage, sanitizeAttachmentFileName, sanitizeChatAttachment } from "../src/server/composition/chat-attachments";

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
const jsonRequest = (body: unknown, origin = "http://localhost:3100"): Request =>
  new Request("http://localhost:3100/api/chat/attachments", { method: "POST", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) });

const WS_ID = "11111111-1111-4111-8111-111111111111", CONV_ID = "22222222-2222-4222-8222-222222222222", MSG_ID = "33333333-3333-4333-8333-333333333333";
let removeFails = false;
function installStorageStub(userId = WS_ID): void {
  process.env.HUBLY_CHAT_PILOT_WORKSPACE_IDS = WS_ID;
  setSupabaseServerClientFactoryForTests(() => ({
    auth: { getUser: async () => ({ data: { user: { id: userId, email: "ana@test.local" } }, error: null }) },
    storage: {
      from: () => ({
        createSignedUploadUrl: async (path: string) => ({ data: { signedUrl: `https://storage.test/upload/${path}`, token: "tok" }, error: null }),
        download: async (path: string) => {
          const bytes = bucketFiles.get(path);
          return bytes ? { data: new Blob([Uint8Array.from(bytes)]), error: null } : { data: null, error: { message: "404" } };
        },
        upload: async (path: string, bytes: Uint8Array) => { bucketFiles.set(path, new Uint8Array(bytes)); return { data: { path }, error: null }; },
        // Como la API real: devuelve solo los objetos que existían y se borraron.
        remove: async (paths: string[]) => {
          calls.push(`remove:${paths.join(",")}`);
          if (removeFails) return { data: null, error: { message: "Storage caído" } };
          const deleted = paths.filter((p) => bucketFiles.delete(p)).map((name) => ({ name }));
          return { data: deleted, error: null };
        },
        createSignedUrl: async (p: string, s: number, opts?: { download?: string | boolean }) =>
          bucketFiles.has(p)
            ? { data: { signedUrl: `https://storage.test/${p}?exp=${s}${opts?.download ? `&download=${encodeURIComponent(String(opts.download))}` : ""}` }, error: null }
            : { data: null, error: { message: "404" } },
      }),
    },
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
  }) as any);
}
const chatRequest = (body: unknown): Request =>
  new Request("http://localhost:3100/api/chat", { method: "POST", headers: { origin: "http://localhost:3100", "content-type": "application/json" }, body: JSON.stringify(body) });
function seedStoredAttachment(id = "55555555-5555-4555-8555-555555555555"): string {
  const path = `${WS_ID}/${CONV_ID}/${id}`;
  storedRows.push({ id, message_id: MSG_ID, object_path: path, file_name: "foto.png", mime_type: "image/png", byte_size: 10, width: 1, height: 1 });
  bucketFiles.set(path, new Uint8Array([1]));
  return path;
}

describe("Adjuntos de chat: firma binaria, limpieza, cuarentena y ruta privada (Issue 205, ADR 0012)", () => {
  afterEach(() => {
    setSupabaseServerClientFactoryForTests(null); storedRows.length = 0; reservedRows.clear(); bucketFiles.clear();
    messageRetired = false; purgeDenied = false; removeFails = false; expiredPaths.length = 0; calls.length = 0; commandSpy.mockClear();
  });

  it("valida firma binaria real, conserva apóstrofos, limpia metadatos y rechaza PDFs con escapes hex o acciones", () => {
    expect(sanitizeAttachmentFileName("plan d'action.pdf")).toBe("plan d'action.pdf");
    const cleanPng = sanitizeChatAttachment(makePng(24, 18, true), "../captura.png");
    expect(cleanPng).toMatchObject({ mimeType: "image/png", fileName: "captura.png", width: 24, height: 18 });
    expect(new TextDecoder().decode(cleanPng.bytes)).not.toContain("Secreto");
    const cleanGif = sanitizeChatAttachment(makeGif(), "anim.gif");
    expect(cleanGif).toMatchObject({ mimeType: "image/gif", width: 8, height: 6 });
    expect(new TextDecoder().decode(cleanGif.bytes)).not.toContain("GPS!");
    expect(sanitizeChatAttachment(makePdf(), "plan d'action.pdf")).toMatchObject({ mimeType: "application/pdf", fileName: "plan d'action.pdf", width: null, height: null });
    // Los enlaces normales (/URI) se aceptan.
    expect(sanitizeChatAttachment(makePdf("/Annots [<< /Subtype /Link /A << /S /URI /URI (https://hubly.mx) >> >>]"), "con-enlace.pdf")).toMatchObject({ mimeType: "application/pdf" });
    expect(() => sanitizeChatAttachment(new TextEncoder().encode("<svg><script>alert(1)</script></svg>"), "falso.png")).toThrow();
    for (const payload of [
      "/JS (app.alert(1))",
      "/S/J\x2361vaScript/J\x2353(app.alert(1))",
      "/S/L\x2361unch/F(cmd.exe)",
      "/OpenAction << /S /URI >>",
      "/Names << /EmbeddedFile 2 0 R >>",
      "/Type /ObjStm /N 1",
    ]) {
      expect(() => sanitizeChatAttachment(makePdf(payload), "malicioso.pdf")).toThrow(/acciones automáticas, archivos incrustados u objetos comprimidos/);
    }
    expect(() => sanitizeChatAttachment(new Uint8Array(CHAT_ATTACHMENT_MAX_BYTES + 1), "enorme.png")).toThrow(/10 MB/);
  });

  it("reserva subida firmada a cuarentena, sanea en commit, borra la cuarentena por la API tras registrar y firma por 1h", async () => {
    installStorageStub();
    expect((await POST(jsonRequest({ op: "reserve" }, "https://evil.example"))).status).toBe(403);
    const png = makePng(16, 12, true);
    const resReserve = await POST(jsonRequest({ op: "reserve", workspaceId: WS_ID, conversationId: CONV_ID, messageId: MSG_ID, files: [{ fileName: "l'image.png", mimeType: "image/png", byteSize: png.byteLength }] }));
    expect(resReserve.status).toBe(200);
    const { reservations } = (await resReserve.json()) as { reservations: Array<{ id: string; quarantinePath: string; signedUrl: string }> };
    expect(reservations[0]?.signedUrl).toContain("/quarantine/");
    bucketFiles.set(reservations[0]!.quarantinePath, png);

    const resCommit = await POST(jsonRequest({ op: "commit", workspaceId: WS_ID, conversationId: CONV_ID, messageId: MSG_ID, reservationIds: [reservations[0]!.id] }));
    expect(resCommit.status).toBe(200);
    const body = (await resCommit.json()) as { attachments: Array<{ id: string; fileName: string; url: string; downloadUrl: string; width: number; height: number }> };
    expect(body.attachments[0]).toMatchObject({ fileName: "l'image.png", width: 16, height: 12 });
    expect(body.attachments[0]?.url).toContain("exp=3600");
    expect(body.attachments[0]?.downloadUrl).toContain("download=l'image.png");
    expect(bucketFiles.has(reservations[0]!.quarantinePath)).toBe(false);
    expect(calls).toContain(`remove:${reservations[0]!.quarantinePath}`);

    expect((await GET(new Request(`http://localhost:3100/api/chat/attachments?workspaceId=${WS_ID}&conversationId=${CONV_ID}&messageId=${MSG_ID}`))).status).toBe(200);
    const purged = await purgeMessageAttachmentsFromStorage(WS_ID, CONV_ID, MSG_ID);
    expect(purged).toContain(body.attachments[0] && `${WS_ID}/${CONV_ID}/${body.attachments[0].id}`);
    expect(bucketFiles.size).toBe(0);
    messageRetired = true;
    expect((await GET(new Request(`http://localhost:3100/api/chat/attachments?workspaceId=${WS_ID}&conversationId=${CONV_ID}&messageId=${MSG_ID}`))).status).toBe(404);
  });

  it("borra de Storage las reservas vencidas antes de reservar, sin bloquear si falla", async () => {
    installStorageStub();
    const stale = `${WS_ID}/${CONV_ID}/quarantine/66666666-6666-4666-8666-666666666666`;
    expiredPaths.push(stale); bucketFiles.set(stale, new Uint8Array([1]));
    const reserve = () => POST(jsonRequest({ op: "reserve", workspaceId: WS_ID, conversationId: CONV_ID, messageId: MSG_ID, files: [{ fileName: "a.png", mimeType: "image/png", byteSize: 10 }] }));
    expect((await reserve()).status).toBe(200);
    expect(bucketFiles.has(stale)).toBe(false);
    removeFails = true;
    expect((await reserve()).status).toBe(200);
  });

  it("solo acepta JSON con op reserve o commit", async () => {
    installStorageStub();
    const form = new FormData(); form.append("files", new Blob([makePng()]), "a.png");
    const multipart = new Request("http://localhost:3100/api/chat/attachments", { method: "POST", headers: { origin: "http://localhost:3100" }, body: form });
    expect((await POST(multipart)).status).toBe(415);
    expect((await POST(jsonRequest({ op: "upload", workspaceId: WS_ID }))).status).toBe(400);
  });

  it("al retirar un mensaje propio borra sus adjuntos con bucket.remove ANTES del comando", async () => {
    // El permiso es el mismo que el de retirar (solo el autor); lo decide SQL (chat_message_attachment_paths).
    installStorageStub();
    const path = seedStoredAttachment();
    const res = await chatPOST(chatRequest({ kind: "remove", workspaceId: WS_ID, conversationId: CONV_ID, messageId: MSG_ID }));
    expect(res.status).toBe(200);
    expect(bucketFiles.has(path)).toBe(false);
    expect(calls[0]).toMatch(/^remove:/);
    expect(calls[0]).toContain(path);
    expect(calls[1]).toBe("command");
    expect(commandSpy).toHaveBeenCalledTimes(1);
  });

  it("si la purga falla o no se confirma, no retira el mensaje y devuelve error", async () => {
    installStorageStub();
    seedStoredAttachment();
    removeFails = true;
    const failedRes = await chatPOST(chatRequest({ kind: "remove", workspaceId: WS_ID, conversationId: CONV_ID, messageId: MSG_ID }));
    expect(failedRes.status).toBe(503);
    expect(commandSpy).not.toHaveBeenCalled();

    // Storage responde sin error pero no borró el adjunto (p. ej. lo filtró la política): tampoco se retira.
    removeFails = false; bucketFiles.clear();
    expect((await chatPOST(chatRequest({ kind: "remove", workspaceId: WS_ID, conversationId: CONV_ID, messageId: MSG_ID }))).status).toBe(503);
    expect(commandSpy).not.toHaveBeenCalled();

    // Quien no puede retirar el mensaje (otra persona, viewer, conversación archivada): SQL 42501, 404,
    // ningún archivo borrado y sin comando.
    purgeDenied = true;
    const callsBefore = calls.length;
    expect((await chatPOST(chatRequest({ kind: "remove", workspaceId: WS_ID, conversationId: CONV_ID, messageId: MSG_ID }))).status).toBe(404);
    expect(calls.slice(callsBefore).some((call) => call.startsWith("remove:"))).toBe(false);
    expect(commandSpy).not.toHaveBeenCalled();
  });
});

describe("Adjuntos por lote para pintar el historial (issue 259)", () => {
  const MSG_ID_2 = "77777777-7777-4777-8777-777777777777";
  const batchGet = (messageIds: string) => new Request(
    `http://localhost:3100/api/chat/attachments?workspaceId=${WS_ID}&conversationId=${CONV_ID}&messageIds=${messageIds}`,
  );

  afterEach(() => {
    setSupabaseServerClientFactoryForTests(null); storedRows.length = 0; reservedRows.clear(); bucketFiles.clear();
    messageRetired = false; purgeDenied = false; removeFails = false; expiredPaths.length = 0; calls.length = 0; commandSpy.mockClear();
  });

  it("GET con messageIds devuelve en una sola respuesta los adjuntos firmados agrupados por mensaje", async () => {
    installStorageStub();
    const firstPath = seedStoredAttachment();
    const secondPath = `${WS_ID}/${CONV_ID}/${MSG_ID_2}`;
    storedRows.push({ id: MSG_ID_2, message_id: MSG_ID_2, object_path: secondPath, file_name: "plan d'action.pdf", mime_type: "application/pdf", byte_size: 4096, width: null, height: null });
    bucketFiles.set(secondPath, new Uint8Array([1]));

    const response = await GET(batchGet(`${MSG_ID},${MSG_ID_2}`));
    expect(response.status).toBe(200);
    const body = await response.json() as { attachmentsByMessage: Record<string, Array<{ fileName: string; url: string; downloadUrl: string }>> };
    expect(Object.keys(body.attachmentsByMessage).sort()).toEqual([MSG_ID, MSG_ID_2].sort());
    expect(body.attachmentsByMessage[MSG_ID]![0]).toMatchObject({
      fileName: "foto.png",
      url: `https://storage.test/${firstPath}?exp=3600`,
      downloadUrl: expect.stringContaining("download=foto.png"),
    });
    expect(body.attachmentsByMessage[MSG_ID_2]![0]).toMatchObject({ fileName: "plan d'action.pdf", mimeType: "application/pdf" });
  });

  it("rechaza lotes con ids inválidos o con más de 50 mensajes", async () => {
    installStorageStub();
    expect((await GET(batchGet("no-es-uuid"))).status).toBe(400);
    const many = Array.from({ length: 51 }, (_, i) => `33333333-3333-4333-8333-${String(i).padStart(12, "0")}`).join(",");
    expect((await GET(batchGet(many))).status).toBe(400);
  });
});

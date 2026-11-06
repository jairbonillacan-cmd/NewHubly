import "server-only";
import { ChatAccessError } from "@hubly/application";
import { withUserContext } from "@hubly/db";
import { createSupabaseServerClient, getVerifiedServerSession } from "./auth";
import { isChatEnabled } from "./chat";
import { sanitizeWallpaperImage, sniffWallpaperType, WallpaperImageError } from "./wallpaper-image";

export const CHAT_ATTACHMENTS_BUCKET = "chat-attachments";
export const CHAT_ATTACHMENTS_ENDPOINT = "/api/chat/attachments";
export const CHAT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const CHAT_ATTACHMENT_MAX_COUNT = 5;
export const CHAT_ATTACHMENT_SIGNED_URL_SECONDS = 60 * 60;
export type ChatAttachmentMimeType = "image/jpeg" | "image/png" | "image/webp" | "image/gif" | "application/pdf";

export class ChatAttachmentError extends Error {
  constructor(message: string) { super(message); this.name = "ChatAttachmentError"; }
}
export interface SanitizedChatAttachment {
  bytes: Uint8Array; mimeType: ChatAttachmentMimeType; fileName: string; byteSize: number; width: number | null; height: number | null;
}
export interface SignedChatAttachment {
  id: string; messageId: string; fileName: string; mimeType: ChatAttachmentMimeType;
  byteSize: number; width: number | null; height: number | null; url: string; downloadUrl: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ascii = (text: string) => Array.from(text, (c) => c.charCodeAt(0));
const startsWith = (b: Uint8Array, sig: readonly number[], off = 0) => b.length >= off + sig.length && sig.every((v, i) => b[off + i] === v);
const invalidFile = (msg = "El archivo no es una imagen (JPEG, PNG, WebP, GIF) ni un PDF válido.") => new ChatAttachmentError(msg);
export const chatAttachmentObjectPath = (wsId: string, convId: string, attId: string) => `${wsId}/${convId}/${attId}`;

export function sanitizeAttachmentFileName(raw: string): string {
  const cleaned = (raw.split(/[/\\]/).pop() ?? "").replace(/[\u0000-\u001f\u007f"'`<>|?*:\\]/g, "_").trim().slice(0, 120);
  return cleaned.length > 0 && /\S/.test(cleaned) ? cleaned : "adjunto";
}

export function sniffChatAttachmentType(bytes: Uint8Array): ChatAttachmentMimeType | null {
  return sniffWallpaperType(bytes) ?? (startsWith(bytes, ascii("GIF87a")) || startsWith(bytes, ascii("GIF89a")) ? "image/gif" : startsWith(bytes, ascii("%PDF-")) ? "application/pdf" : null);
}

function extractDimensions(bytes: Uint8Array, mime: "image/jpeg" | "image/png" | "image/webp"): { width: number; height: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (mime === "image/png") {
    if (bytes.length < 24 || view.getUint32(16) <= 0 || view.getUint32(20) <= 0) throw invalidFile();
    return { width: view.getUint32(16), height: view.getUint32(20) };
  }
  if (mime === "image/jpeg") {
    let off = 2;
    while (off + 4 <= bytes.length) {
      if (bytes[off] !== 0xff) throw invalidFile();
      while (bytes[off + 1] === 0xff) off += 1;
      const m = bytes[off + 1]!;
      if (m === 0xd9 || m === 0xda) break;
      if ((m >= 0xd0 && m <= 0xd7) || m === 0x01) { off += 2; continue; }
      const len = (bytes[off + 2]! << 8) | bytes[off + 3]!;
      if (len < 2 || off + 2 + len > bytes.length) throw invalidFile();
      if ((m >= 0xc0 && m <= 0xc3) || (m >= 0xc5 && m <= 0xc7) || (m >= 0xc9 && m <= 0xcb) || (m >= 0xcd && m <= 0xcf)) {
        const height = (bytes[off + 5]! << 8) | bytes[off + 6]!, width = (bytes[off + 7]! << 8) | bytes[off + 8]!;
        if (len < 7 || width <= 0 || height <= 0) throw invalidFile();
        return { width, height };
      }
      off += 2 + len;
    }
    throw invalidFile();
  }
  const fourcc = String.fromCharCode(...bytes.subarray(12, 16));
  if (fourcc === "VP8X" && bytes.length >= 30) return { width: 1 + (bytes[24]! | (bytes[25]! << 8) | (bytes[26]! << 16)), height: 1 + (bytes[27]! | (bytes[28]! << 8) | (bytes[29]! << 16)) };
  if (fourcc === "VP8L" && bytes.length >= 25 && bytes[20] === 0x2f) { const bits = view.getUint32(21, true); return { width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 }; }
  if (fourcc === "VP8 " && bytes.length >= 30 && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) return { width: view.getUint16(26, true) & 0x3fff, height: view.getUint16(28, true) & 0x3fff };
  throw invalidFile();
}

function stripGif(bytes: Uint8Array): { bytes: Uint8Array; width: number; height: number } {
  if (bytes.length < 14) throw invalidFile();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint16(6, true), height = view.getUint16(8, true), packed = bytes[10]!;
  let off = 13 + ((packed & 0x80) !== 0 ? 3 * (1 << ((packed & 0x07) + 1)) : 0);
  if (width <= 0 || height <= 0 || off >= bytes.length) throw invalidFile();
  const parts: Uint8Array[] = [bytes.subarray(0, off)];
  let hasFrame = false;
  const skipBlocks = (start: number): number => {
    for (let p = start; p < bytes.length; ) { const s = bytes[p]!; p += 1; if (s === 0) return p; p += s; }
    throw invalidFile();
  };
  while (off < bytes.length) {
    const tag = bytes[off]!;
    if (tag === 0x3b && hasFrame) {
      parts.push(Uint8Array.of(0x3b));
      const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0));
      let pos = 0; for (const p of parts) { out.set(p, pos); pos += p.length; }
      return { bytes: out, width, height };
    }
    if (tag === 0x21 && bytes[off + 1] !== undefined) {
      const label = bytes[off + 1]!, end = skipBlocks(off + 2);
      if (label === 0xf9 || (label === 0xff && off + 14 <= end && startsWith(bytes, ascii("NETSCAPE2.0"), off + 3))) parts.push(bytes.subarray(off, end));
      off = end; continue;
    }
    if (tag === 0x2c && off + 10 <= bytes.length) {
      const lp = bytes[off + 9]!, lzw = off + 10 + ((lp & 0x80) !== 0 ? 3 * (1 << ((lp & 0x07) + 1)) : 0);
      if (lzw >= bytes.length) throw invalidFile();
      const end = skipBlocks(lzw + 1);
      parts.push(bytes.subarray(off, end)); hasFrame = true; off = end; continue;
    }
    throw invalidFile();
  }
  throw invalidFile();
}

function sanitizePdf(bytes: Uint8Array): Uint8Array {
  if (bytes.length < 16 || !startsWith(bytes, ascii("%PDF-"))) throw invalidFile();
  const text = new TextDecoder("latin1").decode(bytes), eof = text.lastIndexOf("%%EOF");
  if (eof < 0 || bytes.length - eof > 1024) throw invalidFile();
  if (/\/(?:JavaScript|JS|Launch)\b/.test(text)) throw invalidFile("Por seguridad no se admiten archivos PDF con acciones o scripts incrustados.");
  let end = eof + 5;
  while (end < bytes.length && (bytes[end] === 0x0a || bytes[end] === 0x0d)) end += 1;
  return bytes.subarray(0, end);
}

export function sanitizeChatAttachment(input: Uint8Array, rawName = "adjunto"): SanitizedChatAttachment {
  if (input.length === 0) throw invalidFile();
  if (input.length > CHAT_ATTACHMENT_MAX_BYTES) throw new ChatAttachmentError("El archivo supera el límite de 10 MB.");
  const mimeType = sniffChatAttachmentType(input);
  if (!mimeType) throw invalidFile();
  const fileName = sanitizeAttachmentFileName(rawName);
  if (mimeType === "image/jpeg" || mimeType === "image/png" || mimeType === "image/webp") {
    try {
      const { bytes } = sanitizeWallpaperImage(input, CHAT_ATTACHMENT_MAX_BYTES);
      return { bytes, mimeType, fileName, byteSize: bytes.length, ...extractDimensions(bytes, mimeType) };
    } catch (error) { throw error instanceof WallpaperImageError ? new ChatAttachmentError(error.message) : error; }
  }
  if (mimeType === "image/gif") { const { bytes, width, height } = stripGif(input); return { bytes, mimeType, fileName, byteSize: bytes.length, width, height }; }
  const bytes = sanitizePdf(input);
  return { bytes, mimeType, fileName, byteSize: bytes.length, width: null, height: null };
}

async function signAttachmentObject(objectPath: string, fileName: string): Promise<{ url: string; downloadUrl: string } | null> {
  const bucket = (await createSupabaseServerClient()).storage.from(CHAT_ATTACHMENTS_BUCKET);
  const [viewRes, dlRes] = await Promise.all([
    bucket.createSignedUrl(objectPath, CHAT_ATTACHMENT_SIGNED_URL_SECONDS),
    bucket.createSignedUrl(objectPath, CHAT_ATTACHMENT_SIGNED_URL_SECONDS, { download: fileName }),
  ]);
  return viewRes.error || !viewRes.data?.signedUrl || dlRes.error || !dlRes.data?.signedUrl ? null : { url: viewRes.data.signedUrl, downloadUrl: dlRes.data.signedUrl };
}

export async function uploadChatMessageAttachments(params: {
  workspaceId: string; conversationId: string; messageId: string; files: ReadonlyArray<{ name: string; bytes: Uint8Array }>;
}): Promise<SignedChatAttachment[]> {
  const { workspaceId, conversationId, messageId, files } = params;
  if (!UUID_RE.test(workspaceId) || !UUID_RE.test(conversationId) || !UUID_RE.test(messageId)) throw new ChatAttachmentError("Identificadores de mensaje o conversación inválidos.");
  const { claims } = await getVerifiedServerSession();
  if (!isChatEnabled(workspaceId)) throw new ChatAccessError();
  if (files.length === 0 || files.length > CHAT_ATTACHMENT_MAX_COUNT) throw new ChatAttachmentError("Puedes adjuntar entre 1 y 5 archivos por mensaje.");
  const items = files.map((f) => ({ id: crypto.randomUUID(), ...sanitizeChatAttachment(f.bytes, f.name) }));
  const bucket = (await createSupabaseServerClient()).storage.from(CHAT_ATTACHMENTS_BUCKET);
  const results: SignedChatAttachment[] = [];
  for (const item of items) {
    const objectPath = chatAttachmentObjectPath(workspaceId, conversationId, item.id);
    const { error: uploadError } = await bucket.upload(objectPath, item.bytes, { contentType: item.mimeType, upsert: false, cacheControl: "3600" });
    if (uploadError) throw new ChatAccessError();
    try {
      const safeName = item.fileName.replaceAll("'", "_");
      const wSql = item.width === null ? "null" : String(Math.trunc(item.width));
      const hSql = item.height === null ? "null" : String(Math.trunc(item.height));
      await withUserContext(claims, (tx) => tx.execute(
        `select private.chat_register_attachment('${workspaceId}'::uuid, '${conversationId}'::uuid, '${messageId}'::uuid, '${item.id}'::uuid, '${safeName}', '${item.mimeType}', ${Math.trunc(item.byteSize)}::integer, ${wSql}::integer, ${hSql}::integer)`,
      ));
    } catch (error) { await bucket.remove([objectPath]).catch(() => undefined); throw error; }
    const signed = await signAttachmentObject(objectPath, item.fileName);
    if (!signed) throw new ChatAccessError();
    results.push({ id: item.id, messageId, fileName: item.fileName, mimeType: item.mimeType, byteSize: item.byteSize, width: item.width, height: item.height, ...signed });
  }
  return results;
}

export async function listSignedChatMessageAttachments(params: { workspaceId: string; conversationId: string; messageId: string }): Promise<SignedChatAttachment[]> {
  const { workspaceId, conversationId, messageId } = params;
  if (!UUID_RE.test(workspaceId) || !UUID_RE.test(conversationId) || !UUID_RE.test(messageId)) throw new ChatAttachmentError("Identificadores de mensaje o conversación inválidos.");
  const { claims } = await getVerifiedServerSession();
  if (!isChatEnabled(workspaceId)) throw new ChatAccessError();
  const rows = await withUserContext(claims, async (tx) => {
    const [msg] = await tx.execute<{ id: string }>(
      `select id from private.chat_messages where workspace_id = '${workspaceId}'::uuid and conversation_id = '${conversationId}'::uuid and id = '${messageId}'::uuid and deleted_at is null`,
    );
    if (!msg) throw new ChatAccessError();
    return tx.execute<{ id: string; message_id: string; object_path: string; file_name: string; mime_type: ChatAttachmentMimeType; byte_size: number; width: number | null; height: number | null }>(
      `select id, message_id, object_path, file_name, mime_type, byte_size, width, height from private.chat_attachments where workspace_id = '${workspaceId}'::uuid and conversation_id = '${conversationId}'::uuid and message_id = '${messageId}'::uuid order by created_at asc, id asc`,
    );
  });
  const out: SignedChatAttachment[] = [];
  for (const r of rows) {
    const signed = await signAttachmentObject(r.object_path, r.file_name);
    if (!signed) throw new ChatAccessError();
    out.push({ id: r.id, messageId: r.message_id, fileName: r.file_name, mimeType: r.mime_type, byteSize: r.byte_size, width: r.width, height: r.height, ...signed });
  }
  return out;
}

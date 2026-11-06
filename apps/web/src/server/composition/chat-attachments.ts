import "server-only";
import { ChatAccessError } from "@hubly/application";
import { sql, withUserContext } from "@hubly/db";
import { createSupabaseServerClient, getVerifiedServerSession } from "./auth";
import { isChatEnabled } from "./chat";
import { sanitizeWallpaperImage, sniffWallpaperType, WallpaperImageError } from "./wallpaper-image";

export const CHAT_ATTACHMENTS_BUCKET = "chat-attachments";
export const CHAT_ATTACHMENTS_ENDPOINT = "/api/chat/attachments";
export const CHAT_ATTACHMENT_MAX_BYTES = 10 * 1024 * 1024;
export const CHAT_ATTACHMENT_MAX_COUNT = 5;
export const CHAT_ATTACHMENT_SIGNED_URL_SECONDS = 60 * 60;
export type ChatAttachmentMimeType = "image/jpeg" | "image/png" | "image/webp" | "image/gif" | "application/pdf";
const ALLOWED_MIMES = new Set<ChatAttachmentMimeType>(["image/jpeg", "image/png", "image/webp", "image/gif", "application/pdf"]);

export class ChatAttachmentError extends Error {
  constructor(message: string) { super(message); this.name = "ChatAttachmentError"; }
}
export interface SanitizedChatAttachment {
  bytes: Uint8Array; mimeType: ChatAttachmentMimeType; fileName: string; byteSize: number; width: number | null; height: number | null;
}
export interface ReservedChatAttachmentUpload {
  id: string; fileName: string; mimeType: ChatAttachmentMimeType; byteSize: number; quarantinePath: string; signedUrl: string; token: string;
}
export interface SignedChatAttachment {
  id: string; messageId: string; fileName: string; mimeType: ChatAttachmentMimeType;
  byteSize: number; width: number | null; height: number | null; url: string; downloadUrl: string;
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// Los enlaces normales (/URI) se admiten; se rechazan acciones automáticas, archivos incrustados y objetos comprimidos.
const PDF_DANGER_RE = /\/(?:JavaScript|JS|Launch|OpenAction|AA|EmbeddedFiles?|RichMedia|ObjStm|SubmitForm|ImportData|GoToR|GoToE|XFA)(?![A-Za-z0-9_])/;
export const CHAT_ATTACHMENT_PDF_REJECTED_MESSAGE = "Este PDF trae acciones automáticas, archivos incrustados u objetos comprimidos que no podemos revisar. Expórtalo de nuevo como PDF sencillo.";
const ascii = (text: string) => Array.from(text, (c) => c.charCodeAt(0));
const startsWith = (b: Uint8Array, sig: readonly number[], off = 0) => b.length >= off + sig.length && sig.every((v, i) => b[off + i] === v);
const invalidFile = (msg = "El archivo no es una imagen (JPEG, PNG, WebP, GIF) ni un PDF válido.") => new ChatAttachmentError(msg);
export const chatAttachmentObjectPath = (wsId: string, convId: string, attId: string) => `${wsId}/${convId}/${attId}`;
export const chatAttachmentQuarantinePath = (wsId: string, convId: string, attId: string) => `${wsId}/${convId}/quarantine/${attId}`;

export function sanitizeAttachmentFileName(raw: string): string {
  const cleaned = (raw.split(/[/\\]/).pop() ?? "").replace(/[\u0000-\u001f\u007f"<>|?*:\\]/g, "_").trim().slice(0, 120);
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
  const decoded = text.replace(/\x23([0-9a-fA-F]{2})/g, (_, hex: string) => String.fromCharCode(Number.parseInt(hex, 16)));
  if (PDF_DANGER_RE.test(text) || PDF_DANGER_RE.test(decoded)) {
    throw invalidFile(CHAT_ATTACHMENT_PDF_REJECTED_MESSAGE);
  }
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

export async function reserveChatAttachmentUploads(params: {
  workspaceId: string; conversationId: string; messageId: string;
  files: ReadonlyArray<{ fileName: string; mimeType: string; byteSize: number }>;
}): Promise<ReservedChatAttachmentUpload[]> {
  const { workspaceId, conversationId, messageId, files } = params;
  if (!UUID_RE.test(workspaceId) || !UUID_RE.test(conversationId) || !UUID_RE.test(messageId)) throw new ChatAttachmentError("Identificadores de mensaje o conversación inválidos.");
  const { claims } = await getVerifiedServerSession();
  if (!isChatEnabled(workspaceId)) throw new ChatAccessError();
  if (files.length === 0 || files.length > CHAT_ATTACHMENT_MAX_COUNT) throw new ChatAttachmentError("Puedes adjuntar entre 1 y 5 archivos por mensaje.");
  const specs = files.map((f) => {
    if (!ALLOWED_MIMES.has(f.mimeType as ChatAttachmentMimeType)) throw invalidFile();
    if (!Number.isFinite(f.byteSize) || f.byteSize <= 0) throw invalidFile();
    if (f.byteSize > CHAT_ATTACHMENT_MAX_BYTES) throw new ChatAttachmentError("El archivo supera el límite de 10 MB.");
    return { fileName: sanitizeAttachmentFileName(f.fileName), mimeType: f.mimeType as ChatAttachmentMimeType, byteSize: Math.trunc(f.byteSize) };
  });
  const bucket = (await createSupabaseServerClient()).storage.from(CHAT_ATTACHMENTS_BUCKET);
  // Antes de que la reserva nueva borre las vencidas, se borran sus objetos por la API de Storage (no bloqueante).
  try {
    const expired = await withUserContext(claims, (tx) => tx.execute<{ object_path: string }>(
      sql`select p as object_path from private.chat_expired_reservation_paths(${workspaceId}::uuid, ${conversationId}::uuid, ${messageId}::uuid) as p`,
    ));
    const expiredPaths = [...expired].map((r) => r.object_path).filter(Boolean);
    if (expiredPaths.length > 0) await bucket.remove(expiredPaths);
  } catch { /* La limpieza de reservas vencidas no impide reservar. */ }
  const rows = await withUserContext(claims, async (tx) => {
    const out: Array<{ id: string; file_name: string; mime_type: ChatAttachmentMimeType; byte_size: number; quarantine_path: string }> = [];
    for (const s of specs) {
      const [row] = await tx.execute<{ id: string; file_name: string; mime_type: ChatAttachmentMimeType; byte_size: number; quarantine_path: string }>(
        sql`select id, file_name, mime_type, byte_size, quarantine_path from private.chat_reserve_attachment_upload(${workspaceId}::uuid, ${conversationId}::uuid, ${messageId}::uuid, ${s.fileName}, ${s.mimeType}, ${s.byteSize}::integer)`,
      );
      if (!row) throw new ChatAccessError();
      out.push(row);
    }
    return out;
  });
  const reservations: ReservedChatAttachmentUpload[] = [];
  for (const r of rows) {
    const quarantinePath = r.quarantine_path || chatAttachmentQuarantinePath(workspaceId, conversationId, r.id);
    const signed = await bucket.createSignedUploadUrl(quarantinePath);
    if (signed.error || !signed.data?.signedUrl) throw new ChatAccessError();
    reservations.push({
      id: r.id, fileName: r.file_name ?? "adjunto", mimeType: r.mime_type, byteSize: r.byte_size,
      quarantinePath, signedUrl: signed.data.signedUrl, token: signed.data.token ?? "",
    });
  }
  return reservations;
}

export async function commitChatAttachmentUploads(params: {
  workspaceId: string; conversationId: string; messageId: string; reservationIds: readonly string[];
}): Promise<SignedChatAttachment[]> {
  const { workspaceId, conversationId, messageId, reservationIds } = params;
  if (!UUID_RE.test(workspaceId) || !UUID_RE.test(conversationId) || !UUID_RE.test(messageId)) throw new ChatAttachmentError("Identificadores de mensaje o conversación inválidos.");
  if (reservationIds.length === 0 || reservationIds.length > CHAT_ATTACHMENT_MAX_COUNT || new Set(reservationIds).size !== reservationIds.length || !reservationIds.every((id) => UUID_RE.test(id))) {
    throw new ChatAttachmentError("Reservas de adjuntos inválidas.");
  }
  const { claims } = await getVerifiedServerSession();
  if (!isChatEnabled(workspaceId)) throw new ChatAccessError();
  const reserved = await withUserContext(claims, async (tx) => {
    const out: Array<{ id: string; file_name: string; quarantine_path: string; final_path: string }> = [];
    for (const id of reservationIds) {
      const [row] = await tx.execute<{ id: string; file_name: string; quarantine_path: string; final_path: string }>(
        sql`select id, file_name, quarantine_path, final_path from private.chat_attachment_reservations where id = ${id}::uuid and workspace_id = ${workspaceId}::uuid and conversation_id = ${conversationId}::uuid and message_id = ${messageId}::uuid and author_id = ${claims.sub}::uuid and expires_at > clock_timestamp()`,
      );
      if (!row) throw new ChatAccessError();
      out.push({
        id: row.id || id, file_name: row.file_name || "adjunto",
        quarantine_path: row.quarantine_path || chatAttachmentQuarantinePath(workspaceId, conversationId, id),
        final_path: row.final_path || chatAttachmentObjectPath(workspaceId, conversationId, id),
      });
    }
    return out;
  });
  const bucket = (await createSupabaseServerClient()).storage.from(CHAT_ATTACHMENTS_BUCKET);
  const quarantinePaths = reserved.map((r) => r.quarantine_path);
  const uploadedFinalPaths: string[] = [];
  const prepared: Array<SanitizedChatAttachment & { id: string; finalPath: string }> = [];
  try {
    for (const r of reserved) {
      const dl = await bucket.download(r.quarantine_path);
      if (dl.error || !dl.data) throw new ChatAttachmentError("No se encontró el archivo subido en cuarentena.");
      const clean = sanitizeChatAttachment(new Uint8Array(await dl.data.arrayBuffer()), r.file_name);
      const { error: uploadError } = await bucket.upload(r.final_path, clean.bytes, { contentType: clean.mimeType, upsert: false, cacheControl: "3600" });
      if (uploadError) throw new ChatAccessError();
      uploadedFinalPaths.push(r.final_path);
      prepared.push({ id: r.id, finalPath: r.final_path, ...clean });
    }
    await withUserContext(claims, async (tx) => {
      for (const item of prepared) {
        await tx.execute(
          sql`select private.chat_register_attachment(${workspaceId}::uuid, ${conversationId}::uuid, ${messageId}::uuid, ${item.id}::uuid, ${item.fileName}, ${item.mimeType}, ${Math.trunc(item.byteSize)}::integer, ${item.width}::integer, ${item.height}::integer)`,
        );
      }
    });
  } catch (error) {
    await bucket.remove([...quarantinePaths, ...uploadedFinalPaths]).catch(() => undefined);
    throw error;
  }
  // Registro correcto: la copia sin sanear se borra por la API de Storage (la política permite borrar la
  // cuarentena de un adjunto ya registrado). Si falla, no se pierde el adjunto; queda para limpieza posterior.
  await bucket.remove(quarantinePaths).catch(() => undefined);
  const results: SignedChatAttachment[] = [];
  for (const item of prepared) {
    const signed = await signAttachmentObject(item.finalPath, item.fileName);
    if (!signed) throw new ChatAccessError();
    results.push({ id: item.id, messageId, fileName: item.fileName, mimeType: item.mimeType, byteSize: item.byteSize, width: item.width, height: item.height, ...signed });
  }
  return results;
}

export class ChatAttachmentPurgeError extends Error {
  constructor() { super("No se pudieron borrar los archivos adjuntos del mensaje. Inténtalo de nuevo."); this.name = "ChatAttachmentPurgeError"; }
}

/**
 * Borra por la API de Storage (bucket.remove) los archivos de un mensaje antes de retirarlo. La lista de rutas y el
 * permiso (autor, u owner/admin que puede leer la conversación) los decide `private.chat_message_attachment_paths`;
 * la política de borrado del bucket aplica la misma regla. Si algún adjunto registrado no se borra, lanza
 * `ChatAttachmentPurgeError` y el mensaje no debe retirarse.
 */
export async function purgeMessageAttachmentsFromStorage(workspaceId: string, conversationId: string, messageId: string): Promise<string[]> {
  if (!UUID_RE.test(workspaceId) || !UUID_RE.test(conversationId) || !UUID_RE.test(messageId)) throw new ChatAttachmentError("Identificadores de mensaje o conversación inválidos.");
  const { claims } = await getVerifiedServerSession();
  if (!isChatEnabled(workspaceId)) throw new ChatAccessError();
  const rows = await withUserContext(claims, (tx) => tx.execute<{ object_path: string; required: boolean }>(
    sql`select object_path, required from private.chat_message_attachment_paths(${workspaceId}::uuid, ${conversationId}::uuid, ${messageId}::uuid)`,
  ));
  const paths = [...new Set([...rows].map((r) => r.object_path).filter(Boolean))];
  if (paths.length === 0) return [];
  const required = [...rows].filter((r) => r.required && r.object_path).map((r) => r.object_path);
  const bucket = (await createSupabaseServerClient()).storage.from(CHAT_ATTACHMENTS_BUCKET);
  const { data, error } = await bucket.remove(paths);
  if (error) throw new ChatAttachmentPurgeError();
  // Storage devuelve los objetos borrados; si la política filtró alguno, no aparece y no se retira el mensaje.
  const removed = new Set((data ?? []).map((o: { name?: string }) => o.name));
  if (required.some((p) => !removed.has(p))) throw new ChatAttachmentPurgeError();
  return paths;
}

export async function listSignedChatMessageAttachments(params: { workspaceId: string; conversationId: string; messageId: string }): Promise<SignedChatAttachment[]> {
  const { workspaceId, conversationId, messageId } = params;
  if (!UUID_RE.test(workspaceId) || !UUID_RE.test(conversationId) || !UUID_RE.test(messageId)) throw new ChatAttachmentError("Identificadores de mensaje o conversación inválidos.");
  const { claims } = await getVerifiedServerSession();
  if (!isChatEnabled(workspaceId)) throw new ChatAccessError();
  const rows = await withUserContext(claims, async (tx) => {
    const [msg] = await tx.execute<{ id: string }>(
      sql`select id from private.chat_messages where workspace_id = ${workspaceId}::uuid and conversation_id = ${conversationId}::uuid and id = ${messageId}::uuid and deleted_at is null`,
    );
    if (!msg) throw new ChatAccessError();
    return tx.execute<{ id: string; message_id: string; object_path: string; file_name: string; mime_type: ChatAttachmentMimeType; byte_size: number; width: number | null; height: number | null }>(
      sql`select id, message_id, object_path, file_name, mime_type, byte_size, width, height from private.chat_attachments where workspace_id = ${workspaceId}::uuid and conversation_id = ${conversationId}::uuid and message_id = ${messageId}::uuid order by created_at asc, id asc`,
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

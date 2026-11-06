import { ChatAccessError, ChatRequestError } from "@hubly/application";
import { SessionExpiredError } from "../../../../server/composition/auth";
import {
  CHAT_ATTACHMENT_MAX_BYTES, CHAT_ATTACHMENT_MAX_COUNT, ChatAttachmentError,
  listSignedChatMessageAttachments, uploadChatMessageAttachments,
} from "../../../../server/composition/chat-attachments";

export const dynamic = "force-dynamic";
const privateHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: privateHeaders });

function sameOrigin(request: Request): boolean {
  const source = request.headers.get("origin");
  if (!source) return false;
  const target = new URL(request.url);
  if (source === target.origin) return true;
  const host = request.headers.get("host"), scheme = request.headers.get("x-forwarded-proto") ?? target.protocol.slice(0, -1);
  return Boolean(host) && (scheme === "https" || scheme === "http") && source === `${scheme}://${host}`;
}

function failed(error: unknown): Response {
  if (error instanceof SessionExpiredError) return json({ error: "Tu sesión caducó." }, 401);
  if (error instanceof ChatAccessError) return json({ error: "Chat o adjunto no disponible." }, 404);
  if (error instanceof ChatAttachmentError) return json({ error: error.message }, 400);
  if (error instanceof ChatRequestError) return json({ error: error.message }, error.reason === "conflict" ? 409 : error.reason === "rate-limit" ? 429 : 400);
  const failure = error as { code?: unknown; cause?: { code?: unknown } } | null;
  switch (failure?.cause?.code ?? failure?.code) {
    case "42501": return json({ error: "Chat o adjunto no disponible." }, 404);
    case "P0429": return json({ error: "Vas demasiado rápido. Espera un momento y vuelve a intentarlo." }, 429);
    case "22023": case "23514": return json({ error: "El archivo adjunto no es válido o supera el límite permitido." }, 400);
    default:
      console.error("[chat-attachments] fallo inesperado", { name: (error as Error | null)?.name, code: failure?.cause?.code ?? failure?.code });
      return json({ error: "No se pudo procesar el archivo adjunto." }, 500);
  }
}

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  try {
    return json({ attachments: await listSignedChatMessageAttachments({
      workspaceId: params.get("workspaceId") ?? "", conversationId: params.get("conversationId") ?? "", messageId: params.get("messageId") ?? "",
    }) });
  } catch (error) { return failed(error); }
}

export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request) || !request.headers.get("content-type")?.toLowerCase().startsWith("multipart/form-data")) {
    return json({ error: "La solicitud de adjuntos no está permitida." }, 403);
  }
  const form = await request.formData().catch(() => null);
  if (!form) return json({ error: "El formulario de adjuntos no es válido." }, 400);
  const rawEntries = form.getAll("files").length > 0 ? form.getAll("files") : form.getAll("file");
  if (rawEntries.length === 0 || rawEntries.length > CHAT_ATTACHMENT_MAX_COUNT) return json({ error: "Puedes adjuntar entre 1 y 5 archivos por mensaje." }, 400);
  try {
    const files: Array<{ name: string; bytes: Uint8Array }> = [];
    for (const entry of rawEntries) {
      if (typeof entry === "string" || typeof entry.arrayBuffer !== "function") return json({ error: "Archivo adjunto inválido." }, 400);
      if (entry.size > CHAT_ATTACHMENT_MAX_BYTES) return json({ error: "El archivo supera el límite de 10 MB." }, 400);
      files.push({ name: entry.name || "adjunto", bytes: new Uint8Array(await entry.arrayBuffer()) });
    }
    return json({ attachments: await uploadChatMessageAttachments({
      workspaceId: String(form.get("workspaceId") ?? ""), conversationId: String(form.get("conversationId") ?? ""), messageId: String(form.get("messageId") ?? ""), files,
    }) });
  } catch (error) { return failed(error); }
}

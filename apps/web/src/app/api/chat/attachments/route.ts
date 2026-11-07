import { ChatAccessError, ChatRequestError } from "@hubly/application";
import { SessionExpiredError } from "../../../../server/composition/auth";
import {
  ChatAttachmentError, commitChatAttachmentUploads, listSignedChatMessageAttachments, reserveChatAttachmentUploads,
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

// Solo JSON: el archivo sube directo a Storage con una URL firmada (op "reserve") y el servidor lo sanea al confirmar (op "commit").
export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return json({ error: "La solicitud de adjuntos no está permitida." }, 403);
  if (request.headers.get("content-type")?.split(";")[0]?.trim().toLowerCase() !== "application/json") {
    return json({ error: "La solicitud de adjuntos debe enviarse como JSON." }, 415);
  }
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "La solicitud de adjuntos no es válida." }, 400);
  const input = body as Record<string, unknown>;
  const workspaceId = String(input.workspaceId ?? ""), conversationId = String(input.conversationId ?? ""), messageId = String(input.messageId ?? "");
  try {
    if (input.op === "reserve") {
      const rawFiles: unknown[] = Array.isArray(input.files) ? input.files : [];
      return json({ reservations: await reserveChatAttachmentUploads({
        workspaceId, conversationId, messageId,
        files: rawFiles.map((raw) => {
          const f = (raw ?? {}) as Record<string, unknown>;
          return { fileName: String(f.fileName ?? "adjunto"), mimeType: String(f.mimeType ?? ""), byteSize: Number(f.byteSize ?? 0) };
        }),
      }) });
    }
    if (input.op === "commit") {
      const reservationIds = Array.isArray(input.reservationIds) ? input.reservationIds.map(String) : [];
      return json({ attachments: await commitChatAttachmentUploads({ workspaceId, conversationId, messageId, reservationIds }) });
    }
    return json({ error: "Operación de adjuntos no válida." }, 400);
  } catch (error) { return failed(error); }
}

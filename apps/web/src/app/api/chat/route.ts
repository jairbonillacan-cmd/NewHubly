import { ChatAccessError, ChatRequestError } from "@hubly/application";
import {
  chatCommandSchema, chatExportSchema, chatHistoryResultSchema, chatHistorySchema, chatMessageSchema,
  chatParticipantSchema, chatScopeSchema, chatSyncResultSchema, chatSyncSchema, type ChatMessage,
} from "@hubly/contracts";
import { SessionExpiredError } from "../../../server/composition/auth";
import { getChatService } from "../../../server/composition/chat";

export const dynamic = "force-dynamic";

const privateHeaders = { "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" };
const json = (value: unknown, status = 200) => Response.json(value, { status, headers: privateHeaders });

function failed(error: unknown) {
  if (error instanceof SessionExpiredError) return json({ error: "Tu sesión caducó." }, 401);
  if (error instanceof ChatAccessError) return json({ error: "Chat o conversación no disponible." }, 404);
  if (error instanceof ChatRequestError) {
    return json({ error: error.message }, error.reason === "conflict" ? 409 : error.reason === "rate-limit" ? 429 : 400);
  }
  const failure = error as { code?: unknown; cause?: { code?: unknown } } | null;
  switch (failure?.cause?.code ?? failure?.code) {
    case "42501": return json({ error: "Chat o conversación no disponible." }, 404);
    case "23505": return json({ error: "Ya existe un canal con ese nombre." }, 409);
    case "P0429": return json({ error: "Vas demasiado rápido. Espera un momento y vuelve a intentarlo." }, 429);
    case "22023":
    case "23514": return json({ error: "La solicitud de chat no es válida." }, 400);
    default:
      // Solo el tipo y el código: nunca el cuerpo de los mensajes ni los datos de la solicitud.
      console.error("[chat] fallo inesperado", { name: (error as Error | null)?.name, code: failure?.cause?.code ?? failure?.code });
      return json({ error: "No se pudo completar la solicitud de chat." }, 500);
  }
}

function download(messages: ChatMessage[], format: "json" | "md") {
  const content = format === "json"
    ? JSON.stringify({ version: 1, messages }, null, 2)
    : ["# Mensajes de la agencia en Hubly", ...messages.map(({ sentAt, conversationId, body }) =>
      `## ${sentAt} · ${conversationId}\n\n${(body ?? "").split("\n").map((line) => `    ${line}`).join("\n")}`),
    ].join("\n\n");
  return new Response(content, { headers: {
    ...privateHeaders,
    "Content-Type": format === "json" ? "application/json; charset=utf-8" : "text/markdown; charset=utf-8",
    "Content-Disposition": `attachment; filename="hubly-chat.${format}"`,
  } });
}

export async function GET(request: Request): Promise<Response> {
  const params = new URL(request.url).searchParams;
  const operation = params.get("op");
  const scope = chatScopeSchema.safeParse({ workspaceId: params.get("workspaceId") });
  if (!scope.success) return json({ error: "La agencia no es válida." }, 400);
  const { workspaceId } = scope.data;
  const conversationId = params.get("conversationId") ?? undefined;
  try {
    const chat = await getChatService(workspaceId);
    switch (operation) {
      case "sync": {
        const after = params.get("after");
        const input = chatSyncSchema.safeParse({ workspaceId, conversationId, after: after === null ? undefined : Number(after) });
        if (!input.success) return json({ error: "El cursor de sincronización no es válido." }, 400);
        return json(chatSyncResultSchema.parse(await chat.sync(workspaceId, input.data.conversationId, input.data.after)));
      }
      case "history": {
        const before = params.get("before");
        const input = chatHistorySchema.safeParse({ workspaceId, conversationId, before: before === null ? undefined : Number(before) });
        if (!input.success) return json({ error: "La página solicitada no es válida." }, 400);
        return json(chatHistoryResultSchema.parse(await chat.history(workspaceId, input.data.conversationId, input.data.before)));
      }
      case "directory":
        return json(chatParticipantSchema.array().parse(await chat.directory(workspaceId)));
      case "export": {
        const input = chatExportSchema.safeParse({ workspaceId, format: params.get("format") });
        if (!input.success) return json({ error: "El formato de descarga no es válido." }, 400);
        return download(chatMessageSchema.array().parse(await chat.exportAgency(workspaceId)), input.data.format);
      }
      default: return json({ error: "La solicitud de chat no es válida." }, 400);
    }
  } catch (error) {
    return failed(error);
  }
}

function sameOrigin(request: Request): boolean {
  const source = request.headers.get("origin");
  if (!source) return false;
  const target = new URL(request.url);
  if (source === target.origin) return true;
  // Next puede normalizar 127.0.0.1 a localhost y el proxy termina HTTPS antes del servidor.
  const host = request.headers.get("host");
  const scheme = request.headers.get("x-forwarded-proto") ?? target.protocol.slice(0, -1);
  return Boolean(host) && (scheme === "https" || scheme === "http") && source === `${scheme}://${host}`;
}

export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)
      || request.headers.get("content-type")?.split(";")[0]?.trim() !== "application/json") {
    return json({ error: "La solicitud de chat no está permitida." }, 403);
  }
  const value: unknown = await request.json().catch(() => null);
  try {
    const scope = chatScopeSchema.safeParse(value);
    if (!scope.success) return json({ error: "La agencia no es válida." }, 400);
    if ((value as { kind?: unknown }).kind === "bootstrap") {
      const chat = await getChatService(scope.data.workspaceId);
      return json({ conversationId: await chat.bootstrap(scope.data.workspaceId) });
    }
    const input = chatCommandSchema.safeParse(value);
    if (!input.success) return json({ error: "Revisa los datos del chat." }, 400);
    const chat = await getChatService(input.data.workspaceId);
    const result = await chat.command(input.data);
    return json(result.message ? { ...result, message: chatMessageSchema.parse(result.message) } : result);
  } catch (error) {
    return failed(error);
  }
}

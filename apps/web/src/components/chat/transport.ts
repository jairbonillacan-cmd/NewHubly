import type { ChatCommand, ChatCommandResult, ChatHistory, ChatParticipant, ChatSync } from "@hubly/contracts";

const chatPath = "/api/chat";

export class ChatRequestError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, { cache: "no-store", ...init });
  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    throw new ChatRequestError(response.status, body?.error ?? "No se pudo conectar con el chat.");
  }
  return await response.json() as T;
}

export function chatTransport(workspaceId: string) {
  function url(op: string, params: Record<string, string> = {}) {
    return `${chatPath}?${new URLSearchParams({ op, workspaceId, ...params })}`;
  }

  function post(input: ChatCommand | { kind: "bootstrap"; workspaceId: string }, signal?: AbortSignal) {
    return request<ChatCommandResult>(chatPath, {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(input),
      ...(signal ? { signal } : {}),
    });
  }

  return {
    bootstrap: (signal?: AbortSignal) => post({ kind: "bootstrap", workspaceId }, signal),
    command: post,
    directory: (signal: AbortSignal) => request<ChatParticipant[]>(url("directory"), { signal }),
    history: (conversationId: string, before: number | null, signal: AbortSignal) =>
      request<ChatHistory>(url("history", { conversationId, ...(before === null ? {} : { before: String(before) }) }), { signal }),
    sync: (conversationId: string | null, after: number, signal: AbortSignal) =>
      request<ChatSync>(url("sync", { after: String(after), ...(conversationId ? { conversationId } : {}) }), { signal }),
    download: (format: "json" | "md") => url("export", { format }),
  };
}

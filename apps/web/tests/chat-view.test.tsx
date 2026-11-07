import type { ChatConversation, ChatMessage } from "@hubly/contracts";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ChatView, type ChatViewProps } from "../src/components/chat/ChatView";

const channel: ChatConversation = {
  id: "general", kind: "channel", slug: "general", peerId: null, archived: false,
  writable: true, unread: true, changeCursor: 2,
};
const entry: ChatMessage = {
  id: "1", conversationId: channel.id, authorId: "actor", body: "<script>Privado</script>",
  number: 1, change: 1, sentAt: "2026-11-05T15:00:00.000Z", editedAt: null, deletedAt: null,
};
const props: ChatViewProps = {
  workspaceName: "Agencia de prueba", userId: "actor", canManage: true, canSend: true, unreadOnly: false,
  conversations: [channel], people: [], currentId: channel.id, messages: [entry], loading: false,
  hasOlder: true, loadingOlder: false, draft: "Mensaje de prueba", sending: false, failedSend: false,
  error: null, notice: null, download: (format) => `/descarga.${format}`, onFilter: vi.fn(),
  onSelect: vi.fn(), onOlder: vi.fn(), onVisible: vi.fn(), onCommand: vi.fn(), onDraft: vi.fn(), onSend: vi.fn(),
};

describe("Interfaz del chat", () => {
  it("identifica historial, controles y estado de reintento y escapa el contenido de los mensajes", () => {
    const html = renderToStaticMarkup(<ChatView {...props} failedSend />);
    for (const label of ["Historial de la conversación", "Nuevo canal", "Nuevo directo", "Ver mensajes anteriores",
      "Reintentar envío", "Descargar mis mensajes en Markdown", "Sin leer"]) expect(html).toContain(label);
    expect(html).toContain("&lt;script&gt;Privado&lt;/script&gt;");
    expect(html).not.toContain("<script>Privado</script>");
    expect(html).not.toContain("Administrar canal");
  });

  it("muestra el retiro sin texto y oculta acciones de escritura al visor", () => {
    const html = renderToStaticMarkup(<ChatView {...props} canManage={false} canSend={false}
      conversations={[{ ...channel, writable: false }]} messages={[{ ...entry, body: null }]} />);
    expect(html).toContain("Mensaje eliminado");
    expect(html).toContain("Conversación de solo lectura.");
    expect(html).not.toContain("Nuevo directo");
    expect(html).not.toContain("<textarea");
  });

  it("mantiene el compositor enfocable mientras envía y no mezcla clases de hover en los botones", () => {
    const html = renderToStaticMarkup(<ChatView {...props} sending />);
    const composer = html.match(/<textarea[^>]*placeholder="Escribe un mensaje…"[^>]*>/)?.[0] ?? "";
    expect(composer).toMatch(/\sreadonly=/i);
    expect(composer).not.toMatch(/\sdisabled/);
    expect(html).toContain("Enviando…");
    expect(html).not.toContain("hover:bg-(--surface-interactive)");
  });

  it("muestra la carga de la lista en lugar de un vacío falso", () => {
    const html = renderToStaticMarkup(<ChatView {...props} conversations={[]} currentId={null} listLoading />);
    expect(html).toContain("Cargando conversaciones…");
    expect(html).not.toContain("Aún no hay conversaciones.");
  });
});

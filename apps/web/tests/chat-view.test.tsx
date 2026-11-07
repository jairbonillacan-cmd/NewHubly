import type { ChatConversation, ChatMessage, ChatParticipant } from "@hubly/contracts";
import { EMOJI_CATEGORIES, EmojiPicker, EquipoDialog, filterEmojis } from "@hubly/ui";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ChatView, type ChatViewProps } from "../src/components/chat/ChatView";
import {
  LONG_PRESS_MS, MessageItem, QUICK_REACTIONS, applyOptimisticReaction, createLongPressController,
  executeOptimisticReaction, formatReactorNames, jumpToQuotedMessage, type ChatMessageView, type ChatReactionSummary,
} from "../src/components/chat/MessageItem";
import { daySeparatorLabel, shouldGroupMessages } from "../src/components/chat/MessageList";
import { ThreadPanel } from "../src/components/chat/ThreadPanel";
import { agencyExportHref } from "../src/components/chat/transport";

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
  error: null, notice: null, now: new Date("2026-11-05T15:02:00.000Z"),
  onFilter: vi.fn(), onSelect: vi.fn(), onOlder: vi.fn(), onVisible: vi.fn(), onCommand: vi.fn(), onDraft: vi.fn(), onSend: vi.fn(),
};

describe("Interfaz del chat", () => {
  it("identifica historial, controles, estado de reintento, nota de exportación del owner y escapa el contenido", () => {
    const html = renderToStaticMarkup(<ChatView {...props} failedSend />);
    for (const label of [
      "Historial de la conversación", "Nuevo canal", "Nuevo directo", "Ver mensajes anteriores",
      "Reintentar envío", "Insertar emoji", "Sin leer",
      "El propietario de la agencia puede exportar los canales desde los ajustes de equipo.",
    ]) expect(html).toContain(label);
    expect(html).not.toContain("Descargar mis mensajes en Markdown");
    expect(html).not.toContain("Descargar mis mensajes en JSON");
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

  it("nunca muestra «Miembro XXXX» cuando falta el nombre, usa inicial neutra «?» e invita a configurar el nombre propio", () => {
    const people: ChatParticipant[] = [
      { id: "actor", name: null, role: "owner", status: "online" },
      { id: "peer-9876", name: "", role: "editor", status: "dnd" },
    ];
    const peerMsg: ChatMessage = {
      ...entry, id: "2", authorId: "peer-9876", body: "Hola equipo", number: 2, change: 2,
    };
    const html = renderToStaticMarkup(<ChatView {...props} people={people} messages={[peerMsg]} />);
    expect(html).not.toContain("Miembro ");
    expect(html).toContain("Compañero sin nombre");
    expect(html).toContain(">?<");
    expect(html).toContain("Aún no tienes un nombre configurado.");
    expect(html).toContain("2 miembros");
    expect(html).toContain("1 en línea");
    expect(html).toContain("bg-(--presence-dnd)");
  });

  it("muestra aviso y botón de reintento cuando falla la carga del directorio", () => {
    const onRetry = vi.fn();
    const html = renderToStaticMarkup(
      <ChatView {...props} directoryError="No se pudo cargar el directorio del equipo." onRetryDirectory={onRetry} />,
    );
    expect(html).toContain("No se pudo cargar el directorio del equipo.");
    expect(html).toContain("Reintentar directorio");
  });

  it("agrupa mensajes consecutivos del mismo autor en 5 minutos, inserta separadores de día y anima solo los nuevos", () => {
    const m1: ChatMessage = { ...entry, id: "m1", authorId: "peer-1", body: " Ayer temprano ", number: 1, sentAt: "2026-11-04T10:00:00.000Z" };
    const m2: ChatMessage = { ...entry, id: "m2", authorId: "peer-1", body: "Primero de hoy", number: 2, sentAt: "2026-11-05T15:00:00.000Z" };
    const m3: ChatMessage = { ...entry, id: "m3", authorId: "peer-1", body: "Seguido en dos minutos", number: 3, sentAt: "2026-11-05T15:02:00.000Z" };
    const m4: ChatMessage = { ...entry, id: "m4", authorId: "peer-1", body: "Diez minutos después", number: 4, sentAt: "2026-11-05T15:12:00.000Z" };

    expect(shouldGroupMessages(m1, m2)).toBe(false);
    expect(shouldGroupMessages(m2, m3)).toBe(true);
    expect(shouldGroupMessages(m3, m4)).toBe(false);
    expect(daySeparatorLabel("2026-11-05T15:00:00.000Z", new Date("2026-11-05T18:00:00.000Z"))).toBe("Hoy");
    expect(daySeparatorLabel("2026-11-04T15:00:00.000Z", new Date("2026-11-05T18:00:00.000Z"))).toBe("Ayer");

    const html = renderToStaticMarkup(
      <ChatView
        {...props}
        people={[{ id: "peer-1", name: "Ana López", role: "editor", status: "online" }]}
        messages={[m1, m2, m3, m4]}
        freshMessageIds={new Set(["m4"])}
        now={new Date("2026-11-05T15:12:30.000Z")}
      />,
    );
    expect(html).toContain('role="separator" aria-label="Ayer"');
    expect(html).toContain('role="separator" aria-label="Hoy"');
    expect(html).not.toMatch(/<li[^>]*role="separator"/i);
    expect(html).toContain('data-grouped="true"');
    expect(html).toContain('dateTime="2026-11-05T15:00:00.000Z"');
    expect(html).toContain("Ahora · 15:12");
    const items = html.match(/<li[^>]*tabindex="-1"[^>]*>/gi) ?? [];
    expect(items).toHaveLength(4);
    expect(items[0]).not.toContain("hubly-chat-msg-enter");
    expect(items[1]).not.toContain("hubly-chat-msg-enter");
    expect(items[2]).not.toContain("hubly-chat-msg-enter");
    expect(items[3]).toContain("hubly-chat-msg-enter");
  });

  it("ofrece un selector de emojis propio por categorías y búsqueda en español sin dependencias externas", () => {
    for (const cat of EMOJI_CATEGORIES) {
      for (const item of cat.items) {
        expect(new TextEncoder().encode(item.emoji).byteLength).toBeLessThanOrEqual(16);
      }
    }
    expect(filterEmojis("corazon").flatMap((c) => c.items.map((i) => i.emoji))).toContain("❤️");
    expect(filterEmojis("fuego").flatMap((c) => c.items.map((i) => i.emoji))).toContain("🔥");
    expect(filterEmojis("inexistente-xyz")).toHaveLength(0);

    const html = renderToStaticMarkup(<EmojiPicker onSelect={vi.fn()} />);
    for (const label of ["Selector de emojis", "Buscar emoji", "Frecuentes", "Gestos", "Emociones", "Trabajo", "Símbolos", "Pulgar arriba"]) {
      expect(html).toContain(label);
    }
    expect(html).toMatch(/<div role="grid" aria-label="Frecuentes"><div role="row"/);
    const emptyHtml = renderToStaticMarkup(<EmojiPicker initialQuery="inexistente-xyz" onSelect={vi.fn()} />);
    expect(emptyHtml).toContain("No hay emojis que coincidan con tu búsqueda.");
    expect(emptyHtml).not.toContain('role="grid"');
  });

  it("muestra en EquipoDialog la exportación del chat de la agencia solo al owner y un aviso a los demás miembros", () => {
    const baseDialogProps = {
      mode: "equipo" as const, onClose: vi.fn(),
      members: [{ userId: "actor", role: "owner" as const, isCurrentUser: true }],
      invitations: [], inviteLink: null, onCreateAgency: vi.fn(), onInvite: vi.fn(), onCopyInvite: vi.fn(),
      onRevokeInvite: vi.fn(), onChangeRole: vi.fn(), onRemoveMember: vi.fn(), onLeave: vi.fn(), onExportOwn: vi.fn(),
      chatExportHref: (format: "json" | "md") => agencyExportHref("ag-1", format),
    };

    const ownerHtml = renderToStaticMarkup(
      <EquipoDialog {...baseDialogProps} workspace={{ id: "ag-1", name: "Agencia Pulso", kind: "agency", role: "owner" }} />,
    );
    expect(ownerHtml).toContain("Exportar chat en JSON");
    expect(ownerHtml).toContain("Exportar chat en Markdown");
    expect(ownerHtml).toContain("/api/chat?op=export&amp;workspaceId=ag-1&amp;format=json");
    expect(ownerHtml).toContain("/api/chat?op=export&amp;workspaceId=ag-1&amp;format=md");
    expect(ownerHtml).toContain("nunca los directos entre otras personas");

    const memberHtml = renderToStaticMarkup(
      <EquipoDialog {...baseDialogProps} workspace={{ id: "ag-1", name: "Agencia Pulso", kind: "agency", role: "editor" }} />,
    );
    expect(memberHtml).not.toContain("Exportar chat en JSON");
    expect(memberHtml).not.toContain("Exportar chat en Markdown");
    expect(memberHtml).toContain("El propietario de la agencia puede exportar los canales desde estos ajustes de equipo.");
  });

  it("muestra barra de acciones con las 6 reacciones rápidas, EmojiPicker, quién reaccionó y pulsación larga en móvil", () => {
    vi.useFakeTimers();
    try {
      const triggered = vi.fn();
      const lp = createLongPressController(triggered);
      lp.start();
      vi.advanceTimersByTime(LONG_PRESS_MS - 50);
      expect(triggered).not.toHaveBeenCalled();
      lp.cancel();
      vi.advanceTimersByTime(100);
      expect(triggered).not.toHaveBeenCalled();
      lp.start();
      vi.advanceTimersByTime(LONG_PRESS_MS);
      expect(triggered).toHaveBeenCalledTimes(1);
    } finally {
      vi.useRealTimers();
    }

    const directory = new Map<string, ChatParticipant>([
      ["peer-1", { id: "peer-1", name: "Ana López", role: "editor", status: "online" }],
      ["peer-2", { id: "peer-2", name: "Carlos Ruiz", role: "admin", status: "away" }],
    ]);
    expect(formatReactorNames(["peer-1", "actor"], "actor", directory)).toBe("Ana López y Tú");
    expect(formatReactorNames(["peer-1", "peer-2", "actor"], "actor", directory)).toBe("Ana López, Carlos Ruiz y Tú");

    const reactions: ChatReactionSummary[] = [
      { emoji: "👍", userIds: ["peer-1", "actor"] },
      { emoji: "🚀", userIds: ["peer-2"] },
    ];
    const itemHtml = renderToStaticMarkup(
      <ul>
        <MessageItem entry={{ ...entry, body: "Propuesta lista", reactions }} name="Tú" people={directory}
          viewerId="actor" isOwn writable canEdit initialActionsOpen initialPickerOpen onCommand={vi.fn()} />
      </ul>,
    );
    expect(itemHtml).toContain('role="toolbar" aria-label="Acciones del mensaje de Tú"');
    expect(itemHtml).toContain('data-actions-open="true"');
    for (const emoji of QUICK_REACTIONS) expect(itemHtml).toContain(`aria-label="Reaccionar con ${emoji}"`);
    for (const text of ["Más emojis", "Responder", "Abrir hilo", "Editar", "Retirar", "Selector de emojis"]) {
      expect(itemHtml).toContain(text);
    }
    expect(itemHtml).toContain('aria-label="👍 2, reaccionaron: Ana López y Tú"');
    expect(itemHtml).toContain('aria-label="🚀 1, reaccionaron: Carlos Ruiz"');
  });

  it("aplica reacciones de forma optimista en el primer fotograma y revierte automáticamente si falla el servidor", async () => {
    const initial: ChatReactionSummary[] = [{ emoji: "👍", userIds: ["peer-1"] }];
    expect(applyOptimisticReaction(initial, "👍", "actor")).toEqual([{ emoji: "👍", userIds: ["peer-1", "actor"] }]);
    expect(applyOptimisticReaction([{ emoji: "👍", userIds: ["actor"] }], "👍", "actor")).toEqual([]);

    const frames: { reactions: readonly ChatReactionSummary[]; error: string | null }[] = [];
    let resolveServer!: (ok: boolean) => void;
    const pendingPromise = executeOptimisticReaction({
      current: initial, emoji: "❤️", userId: "actor",
      applyState: (reactions, error) => frames.push({ reactions, error }),
      persist: () => new Promise<boolean>((resolve) => { resolveServer = resolve; }),
    });

    expect(frames).toEqual([{
      reactions: [{ emoji: "👍", userIds: ["peer-1"] }, { emoji: "❤️", userIds: ["actor"] }],
      error: null,
    }]);
    resolveServer(true);
    await expect(pendingPromise).resolves.toMatchObject({ ok: true, error: null });

    const rollbackFrames: { reactions: readonly ChatReactionSummary[]; error: string | null }[] = [];
    const failedResult = await executeOptimisticReaction({
      current: initial, emoji: "🎉", userId: "actor",
      applyState: (reactions, error) => rollbackFrames.push({ reactions, error }),
      persist: () => Promise.reject(new Error("Fallo de red")),
    });
    expect(failedResult.ok).toBe(false);
    expect(rollbackFrames[0]?.reactions).toEqual([{ emoji: "👍", userIds: ["peer-1"] }, { emoji: "🎉", userIds: ["actor"] }]);
    expect(rollbackFrames[1]).toEqual({ reactions: initial, error: "No se pudo guardar la reacción." });

    const errorHtml = renderToStaticMarkup(
      <ChatView {...props} reactionErrorsByMessage={{ [entry.id]: "No se pudo guardar la reacción." }} />,
    );
    expect(errorHtml).toContain("No se pudo guardar la reacción.");
    expect(errorHtml).toContain("Reintentar reacción");
  });

  it("muestra cita de respuesta con salto al mensaje original y abre, responde y cierra ThreadPanel", () => {
    const rootMsg: ChatMessageView = {
      ...entry, id: "root-1", authorId: "peer-1", body: "Definamos el calendario de entrega", number: 1,
      threadReplyCount: 2, threadLastReplyAt: "2026-11-05T15:10:00.000Z",
    };
    const replyInline: ChatMessageView = {
      ...entry, id: "msg-2", authorId: "actor", body: "De acuerdo con la propuesta", number: 2,
      sentAt: "2026-11-05T15:04:00.000Z", replyToId: "root-1",
    };
    const threadReply1: ChatMessageView = {
      ...entry, id: "th-1", authorId: "actor", body: "Subo el cronograma aquí en el hilo", number: 3,
      sentAt: "2026-11-05T15:08:00.000Z", threadRootId: "root-1",
    };

    const scrollIntoView = vi.fn();
    const focus = vi.fn();
    const fakeDoc = {
      getElementById: vi.fn((id: string) => id === "chat-msg-root-1" ? ({ scrollIntoView, focus } as unknown as HTMLElement) : null),
    };
    expect(jumpToQuotedMessage("root-1", fakeDoc, false)).toBe(true);
    expect(scrollIntoView).toHaveBeenCalledWith({ behavior: "smooth", block: "center" });
    expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    expect(jumpToQuotedMessage("root-1", fakeDoc, true)).toBe(true);
    expect(scrollIntoView).toHaveBeenLastCalledWith({ behavior: "auto", block: "center" });

    const viewHtml = renderToStaticMarkup(
      <ChatView {...props} people={[{ id: "peer-1", name: "Ana López", role: "editor", status: "online" }]}
        messages={[rootMsg, replyInline]} threadMessages={[threadReply1]} activeThreadRootId="root-1"
        replyingToMessageId="root-1" highlightedMessageId="root-1" />,
    );
    for (const expected of [
      'aria-label="Ir al mensaje citado de Ana López"', "2 respuestas · Ver hilo", "Última a las 15:10",
      'data-highlighted="true"', "Respondiendo a Ana López:", "Cancelar respuesta",
      "Mensaje principal del hilo", "Subo el cronograma aquí en el hilo", "Responder en el hilo",
      "Enviar al hilo", "Cerrar hilo",
    ]) expect(viewHtml).toContain(expected);

    const panelHtml = renderToStaticMarkup(
      <ThreadPanel rootMessage={rootMsg} replies={[]} userId="actor" writable={false} onClose={vi.fn()}
        people={new Map([["peer-1", { id: "peer-1", name: "Ana López", role: "editor", status: "online" }]])} />,
    );
    expect(panelHtml).toContain("Todavía no hay respuestas en este hilo.");
    expect(panelHtml).not.toContain("Responder en el hilo");
  });
});

describe("Revisión de Prisma del PR 261", () => {
  const directory = new Map<string, ChatParticipant>([
    ["peer-1", { id: "peer-1", name: "Ana López", role: "editor", status: "online" }],
    ["peer-2", { id: "peer-2", name: "Carlos Ruiz", role: "admin", status: "away" }],
  ]);
  it("la barra de acciones no se pinta visible por defecto: una sola entrada «Acciones» y la barra oculta", () => {
    const html = renderToStaticMarkup(
      <ul>
        <MessageItem entry={{ ...entry, body: "Propuesta lista" }} name="Tú" people={directory}
          viewerId="actor" isOwn writable canEdit onCommand={vi.fn()} />
      </ul>,
    );
    expect(html).toContain('aria-label="Acciones del mensaje de Tú" aria-expanded="false"');
    const toolbar = html.match(/<div role="toolbar"[^>]*>/)?.[0] ?? "";
    expect(toolbar).toMatch(/class="[^"]*\bhidden\b[^"]*lg:group-hover:flex[^"]*lg:absolute/);
    expect(toolbar).not.toContain("data-actions-open");
  });

  it("horas y separadores de día en la zona del navegador, no en UTC", () => {
    const previous = process.env.TZ;
    process.env.TZ = "America/Mexico_City";
    try {
      // 03:00 UTC del 7 son las 21:00 del 6 en Ciudad de México.
      expect(daySeparatorLabel("2026-11-07T03:00:00.000Z", new Date("2026-11-07T05:00:00.000Z"))).toBe("Hoy");
      expect(daySeparatorLabel("2026-11-06T03:00:00.000Z", new Date("2026-11-07T05:00:00.000Z"))).toBe("Ayer");
      const html = renderToStaticMarkup(
        <ul><MessageItem entry={{ ...entry, body: "Hola", sentAt: "2026-11-07T16:00:00.000Z" }} name="Ana" people={directory}
          viewerId="actor" canEdit={false} onCommand={vi.fn()} /></ul>,
      );
      expect(html).toContain(">10:00<");
    } finally {
      process.env.TZ = previous;
    }
  });

  it("«Nuevo directo» comparte la fila compacta con «Nuevo canal»", () => {
    const html = renderToStaticMarkup(<ChatView {...props} people={[...directory.values()]} />);
    // «Nuevo directo» va justo después de «Nuevo canal», dentro de la misma fila (sin cerrar el <div> entre ambos).
    expect(html).toContain('<div data-chat-list-actions="" class="flex flex-wrap items-start gap-x-2');
    expect(html).toMatch(/<\/details><details class="text-sm"><summary[^>]*>Nuevo directo<\/summary>/);
    expect(html).not.toMatch(/<\/details><\/div><details class="text-sm"><summary[^>]*>Nuevo directo/);
    // Sin permisos de gestión, la fila tampoco queda vacía: contiene el directo.
    const member = renderToStaticMarkup(<ChatView {...props} canManage={false} people={[...directory.values()]} />);
    expect(member).toMatch(/<div data-chat-list-actions="" class="[^"]*"><details class="text-sm"><summary[^>]*>Nuevo directo/);
  });
});

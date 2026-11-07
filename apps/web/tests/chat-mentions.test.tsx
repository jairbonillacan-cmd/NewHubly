import type { ChatConversation, ChatParticipant } from "@hubly/contracts";
import { Carril, EspacioHoy } from "@hubly/ui";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import {
  discountUnreadMentions,
  formatDocumentTitleWithMentions,
  notifyHiddenTabMention,
  syncDocumentTitleMentions,
} from "../src/components/chat/ChatScreen";
import { ChatView, type ChatViewProps } from "../src/components/chat/ChatView";
import {
  messageMentionsViewer,
  parseMessageMentions,
  type ChatMessageView,
} from "../src/components/chat/MessageItem";
import { collectVisibleUnreadMentions } from "../src/components/chat/MessageList";

const channel: ChatConversation = {
  id: "general",
  kind: "channel",
  slug: "general",
  peerId: null,
  archived: false,
  writable: true,
  unread: true,
  changeCursor: 4,
};

const people: ChatParticipant[] = [
  { id: "viewer-1", name: "Ana García", role: "owner", status: "online" },
  { id: "peer-2", name: "Bruno Díaz", role: "editor", status: "online" },
];

const peopleMap = new Map(people.map((person) => [person.id, person]));

const baseProps: ChatViewProps = {
  workspaceName: "Agencia Creativa",
  userId: "viewer-1",
  canManage: true,
  canSend: true,
  unreadOnly: false,
  conversations: [channel],
  people,
  currentId: channel.id,
  messages: [],
  loading: false,
  hasOlder: false,
  loadingOlder: false,
  draft: "",
  sending: false,
  failedSend: false,
  error: null,
  notice: null,
  now: new Date("2026-11-05T15:05:00.000Z"),
  onFilter: vi.fn(),
  onSelect: vi.fn(),
  onOlder: vi.fn(),
  onVisible: vi.fn(),
  onCommand: vi.fn(),
  onDraft: vi.fn(),
  onSend: vi.fn(),
};

describe("Notificaciones y resaltado de menciones en el chat (issue 208)", () => {
  it("resalta visualmente las menciones en el mensaje y destaca la fila cuando mencionan a la persona autenticada", () => {
    const mentionMsg: ChatMessageView = {
      id: "m-1",
      conversationId: channel.id,
      authorId: "peer-2",
      body: "Hola @Ana García y @Bruno Díaz, revisen el brief por favor",
      number: 1,
      change: 1,
      sentAt: "2026-11-05T15:00:00.000Z",
      editedAt: null,
      deletedAt: null,
    };

    const segments = parseMessageMentions(mentionMsg.body ?? "", peopleMap, "viewer-1");
    expect(segments).toEqual([
      { text: "Hola ", isMention: false, mentionsViewer: false },
      { text: "@Ana García", isMention: true, mentionsViewer: true, userId: "viewer-1" },
      { text: " y ", isMention: false, mentionsViewer: false },
      { text: "@Bruno Díaz", isMention: true, mentionsViewer: false, userId: "peer-2" },
      { text: ", revisen el brief por favor", isMention: false, mentionsViewer: false },
    ]);
    expect(messageMentionsViewer(mentionMsg, peopleMap, "viewer-1")).toBe(true);

    const html = renderToStaticMarkup(
      <ChatView {...baseProps} messages={[mentionMsg]} unreadMentionsCount={1} />,
    );
    expect(html).toContain('data-mentions-viewer="true"');
    expect(html).toContain('data-mention="viewer"');
    expect(html).toContain('data-mention="member"');
    expect(html).toContain("bg-(--accent-primary-subtle)");
    expect(html).not.toContain("--surface-brand-soft");
    expect(html).toContain("border-(--accent-primary)");
    expect(html).toContain('data-chat-unread-mentions="1"');
  });

  it("muestra el contador numérico de menciones sin leer en el carril lateral y en el chip de Hoy", () => {
    const carrilHtml = renderToStaticMarkup(
      <Carril
        activa="hoy"
        expandido
        hoyPendientes={0}
        onSelect={vi.fn()}
        onToggleExpandido={vi.fn()}
        chat={{ href: "/chat", unreadMentions: 3, active: false }}
      />,
    );
    expect(carrilHtml).toContain('data-carril-mentions="3"');
    expect(carrilHtml).toContain("Chat, 3 menciones sin leer");
    expect(carrilHtml).toContain('>Chat</span> <span data-carril-mentions="3"');

    const carrilCollapsedHtml = renderToStaticMarkup(
      <Carril
        activa="hoy"
        expandido={false}
        hoyPendientes={0}
        onSelect={vi.fn()}
        onToggleExpandido={vi.fn()}
        chat={{ href: "/chat", unreadMentions: 1, active: false }}
      />,
    );
    expect(carrilCollapsedHtml).toContain('data-carril-mentions="1"');
    expect(carrilCollapsedHtml).toContain("Chat, 1 mención sin leer");

    const hoyHtml = renderToStaticMarkup(
      <EspacioHoy
        todayDate="2026-11-05"
        todos={[]}
        notes={[]}
        noteSaveStates={{}}
        analyzeCapture={(text) => ({ title: text, priority: "medium", dueDate: null, dueKeyword: null, noteQuery: null, tokens: [] })}
        onCapture={vi.fn(async () => true)}
        onToggleTodo={vi.fn()}
        onCreateNote={vi.fn(async () => "n-1")}
        onSaveNote={vi.fn()}
        onTogglePin={vi.fn()}
        onToggleArchive={vi.fn()}
        onExport={vi.fn()}
        onSignOut={vi.fn()}
        chatUnreadMentions={2}
        chat={{
          todayHref: "/hub",
          href: "/chat",
          unreadHref: "/chat/sin-leer",
          unread: 1,
          unreadMentions: 2,
          active: false,
        }}
      />,
    );
    expect(hoyHtml).toContain('data-hoy-mentions="2"');
    expect(hoyHtml).toContain("2 menciones sin leer");
    expect(hoyHtml).toContain('data-carril-mentions="2"');
    expect(hoyHtml).toContain("bg-(--accent-primary-subtle)");
    expect(hoyHtml).not.toContain("--surface-brand-soft");
  });

  it("actualiza el título de la pestaña con (N) cuando hay menciones sin leer y lo restaura al llegar a 0 o desmontar", () => {
    expect(formatDocumentTitleWithMentions("Hubly — Agencia", 3)).toBe("(3) Hubly — Agencia");
    expect(formatDocumentTitleWithMentions("(3) Hubly — Agencia", 1)).toBe("(1) Hubly — Agencia");
    expect(formatDocumentTitleWithMentions("(1) Hubly — Agencia", 0)).toBe("Hubly — Agencia");

    const fakeDoc = { title: "Hubly" };
    const restoreFirst = syncDocumentTitleMentions(fakeDoc, 2);
    expect(fakeDoc.title).toBe("(2) Hubly");

    const restoreZero = syncDocumentTitleMentions(fakeDoc, 0);
    expect(fakeDoc.title).toBe("Hubly");
    restoreZero();

    syncDocumentTitleMentions(fakeDoc, 4);
    expect(fakeDoc.title).toBe("(4) Hubly");
    restoreFirst();
    expect(fakeDoc.title).toBe("Hubly");
  });

  it("muestra el botón «Activar avisos del navegador» y solo dispara Notification cuando la pestaña está oculta y con permiso concedido", () => {
    const defaultHtml = renderToStaticMarkup(
      <ChatView
        {...baseProps}
        notificationPermission="default"
        onRequestNotificationPermission={vi.fn()}
      />,
    );
    expect(defaultHtml).toContain("Activar avisos del navegador");

    const grantedHtml = renderToStaticMarkup(
      <ChatView {...baseProps} notificationPermission="granted" />,
    );
    expect(grantedHtml).toContain("Avisos del navegador activos");
    expect(grantedHtml).not.toContain("Activar avisos del navegador");

    const deniedHtml = renderToStaticMarkup(
      <ChatView {...baseProps} notificationPermission="denied" />,
    );
    expect(deniedHtml).toContain("Avisos del navegador bloqueados");

    const created: Array<{ title: string; options: { body: string; tag?: string } }> = [];
    const createNotification = vi.fn((title: string, options: { body: string; tag?: string }) => {
      created.push({ title, options });
    });

    // Nunca dispara si la pestaña está visible.
    expect(
      notifyHiddenTabMention({
        authorName: "Bruno Díaz",
        conversationTitle: "#general",
        body: "Hola @Ana García",
        visibilityState: "visible",
        permission: "granted",
        explicitlyEnabled: true,
        createNotification,
        messageId: "m-1",
      }),
    ).toBe(false);
    expect(createNotification).not.toHaveBeenCalled();

    // Nunca dispara sin permiso concedido.
    expect(
      notifyHiddenTabMention({
        authorName: "Bruno Díaz",
        conversationTitle: "#general",
        body: "Hola @Ana García",
        visibilityState: "hidden",
        permission: "default",
        explicitlyEnabled: true,
        createNotification,
        messageId: "m-1",
      }),
    ).toBe(false);
    expect(createNotification).not.toHaveBeenCalled();

    // Nunca dispara si la persona no activó explícitamente los avisos.
    expect(
      notifyHiddenTabMention({
        authorName: "Bruno Díaz",
        conversationTitle: "#general",
        body: "Hola @Ana García",
        visibilityState: "hidden",
        permission: "granted",
        explicitlyEnabled: false,
        createNotification,
        messageId: "m-1",
      }),
    ).toBe(false);
    expect(createNotification).not.toHaveBeenCalled();

    // Dispara únicamente cuando la pestaña está en segundo plano (hidden) y con permiso explícito concedido.
    expect(
      notifyHiddenTabMention({
        authorName: "Bruno Díaz",
        conversationTitle: "#general",
        body: "Hola @Ana García, revisa el cambio",
        visibilityState: "hidden",
        permission: "granted",
        explicitlyEnabled: true,
        createNotification,
        messageId: "m-1",
      }),
    ).toBe(true);
    expect(createNotification).toHaveBeenCalledTimes(1);
    expect(created[0]).toEqual({
      title: "Bruno Díaz te mencionó en #general",
      options: {
        body: "Hola @Ana García, revisa el cambio",
        tag: "hubly-mention-m-1",
      },
    });
  });

  it("marca automáticamente como leídas las menciones visibles en la conversación abierta con pestaña activa", () => {
    const messages: ChatMessageView[] = [
      {
        id: "m-1",
        conversationId: channel.id,
        authorId: "peer-2",
        body: "Hola @Ana García",
        number: 1,
        change: 1,
        sentAt: "2026-11-05T15:00:00.000Z",
        editedAt: null,
        deletedAt: null,
      },
      {
        id: "m-2",
        conversationId: channel.id,
        authorId: "peer-2",
        body: "Mensaje sin mención",
        number: 2,
        change: 2,
        sentAt: "2026-11-05T15:01:00.000Z",
        editedAt: null,
        deletedAt: null,
      },
      {
        id: "m-3",
        conversationId: channel.id,
        authorId: "peer-2",
        body: "Segundo aviso para @Ana García",
        number: 3,
        change: 3,
        sentAt: "2026-11-05T15:02:00.000Z",
        editedAt: null,
        deletedAt: null,
      },
    ];

    const unreadSet = new Set(["m-1", "m-3"]);

    // Con la pestaña oculta no se marcan como vistas.
    expect(
      collectVisibleUnreadMentions({
        conversationId: channel.id,
        visibleThroughNumber: 3,
        visibilityState: "hidden",
        messages,
        unreadMentionIds: unreadSet,
        viewerId: "viewer-1",
        people: peopleMap,
      }),
    ).toEqual({ messageIds: [], maxMessageNumber: null });

    // Con la pestaña visible se recogen las menciones hasta el mensaje visible y se descuentan.
    const visibleResult = collectVisibleUnreadMentions({
      conversationId: channel.id,
      visibleThroughNumber: 3,
      visibilityState: "visible",
      messages,
      unreadMentionIds: unreadSet,
      viewerId: "viewer-1",
      people: peopleMap,
    });
    expect(visibleResult).toEqual({
      messageIds: ["m-1", "m-3"],
      maxMessageNumber: 3,
    });

    // Detecta menciones del historial marcadas con unreadMention: true aunque unreadMentionIds esté vacío.
    const historyMessages: ChatMessageView[] = [
      { ...messages[0]!, unreadMention: true },
      messages[1]!,
    ];
    expect(
      collectVisibleUnreadMentions({
        conversationId: channel.id,
        visibleThroughNumber: 2,
        visibilityState: "visible",
        messages: historyMessages,
        unreadMentionIds: new Set(),
        viewerId: "viewer-1",
        people: peopleMap,
      }),
    ).toEqual({
      messageIds: ["m-1"],
      maxMessageNumber: 1,
    });

    // No vuelve a reportar IDs que ya fueron reportados previamente (alreadyReportedIds).
    expect(
      collectVisibleUnreadMentions({
        conversationId: channel.id,
        visibleThroughNumber: 3,
        visibilityState: "visible",
        messages,
        unreadMentionIds: unreadSet,
        alreadyReportedIds: new Set(["m-1"]),
        viewerId: "viewer-1",
        people: peopleMap,
      }),
    ).toEqual({
      messageIds: ["m-3"],
      maxMessageNumber: 3,
    });

    // Descuento exacto sin doble resta entre unreadMentionIds y extraUnreadMentions.
    const afterLiveRead = discountUnreadMentions({
      unreadMentionIds: new Set(["m-3"]),
      extraUnreadMentions: 2,
      readMessageIds: ["m-3"],
    });
    expect(afterLiveRead.unreadMentionIds.size).toBe(0);
    expect(afterLiveRead.extraUnreadMentions).toBe(2);

    const afterHistoryRead = discountUnreadMentions({
      unreadMentionIds: new Set(["m-3"]),
      extraUnreadMentions: 2,
      readMessageIds: ["m-1", "m-3"],
    });
    expect(afterHistoryRead.unreadMentionIds.size).toBe(0);
    expect(afterHistoryRead.extraUnreadMentions).toBe(1);
  });
});

import type { ChatConversation, ChatParticipant } from "@hubly/contracts";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ChatAttachmentList, formatAttachmentBytes, type ChatAttachmentItem } from "../src/components/chat/ChatAttachmentView";
import {
  Composer, MAX_CHAT_ATTACHMENT_BYTES, MAX_CHAT_ATTACHMENTS, TYPING_COOLDOWN_MS,
  applyMentionSelection, detectMentionQuery, filterMentionCandidates, formatTypingIndicator, revokePreviewUrl,
  uploadComposerAttachments, validateAndAddAttachments, type ComposerAttachmentDraft,
} from "../src/components/chat/Composer";
import { draftAfterSend, mentionsToSend } from "../src/components/chat/ChatScreen";
import { ChatView, type ChatViewProps } from "../src/components/chat/ChatView";
import { ThreadPanel, type ThreadMessageView } from "../src/components/chat/ThreadPanel";

const members: ChatParticipant[] = [
  { id: "u-self", name: "Jair Bonilla", role: "owner", status: "online" },
  { id: "u-ana", name: "Ana López", role: "admin", status: "online" },
  { id: "u-beto", name: "Beto Ruiz", role: "editor", status: "away" },
  { id: "u-anon", name: null, role: "editor", status: "dnd" },
];

describe("Compositor del chat: @menciones, emojis, adjuntos, indicador escribiendo y dimensiones en hilos (issue 207)", () => {
  it("detecta @mención, filtra miembros con avatar/inicial y presencia, e inserta mención seleccionando userId", () => {
    expect(detectMentionQuery("Hola @ana")).toEqual({ query: "ana", start: 5, end: 9 });
    expect(detectMentionQuery("correo@dominio.com")).toBeNull();

    const filtered = filterMentionCandidates(members, "ana", "u-self");
    expect(filtered.map((m) => m.id)).toEqual(["u-ana"]);
    const allPeers = filterMentionCandidates(members, "", "u-self");
    expect(allPeers.map((m) => m.id)).toEqual(["u-ana", "u-beto", "u-anon"]);

    const applied = applyMentionSelection("Revisa esto @ana por favor", { start: 12, end: 16 }, members[1]!);
    expect(applied.nextDraft).toBe("Revisa esto @Ana López  por favor");

    const html = renderToStaticMarkup(
      <Composer writable loading={false} draft="Hola @" sending={false} failedSend={false}
        userId="u-self" members={members} onDraft={vi.fn()} onSend={vi.fn()} />,
    );
    expect(html).toContain('role="listbox" aria-label="Mencionar a un compañero"');
    expect(html).toContain('aria-activedescendant="chat-mention-opt-u-ana"');
    expect(html).toContain("Ana López");
    expect(html).toContain("En línea");
    expect(html).toContain("Beto Ruiz");
    expect(html).toContain("Ausente");
    expect(html).toContain("Compañero sin nombre");
    expect(html).toContain(">?<");
    expect(html).toContain("No molestar");
  });

  it("valida adjuntos (máximo 5 archivos, 10 MB y 5 tipos MIME), muestra vista previa y barra de progreso accesible", () => {
    const img = new File([new Uint8Array([1, 2, 3, 4])], "captura.png", { type: "image/png" });
    const pdf = new File([new Uint8Array(2048)], "propuesta.pdf", { type: "application/pdf" });

    const ok1 = validateAndAddAttachments([], [img, pdf]);
    expect(ok1.error).toBeNull();
    expect(ok1.attachments).toHaveLength(2);

    const badMime = new File([new Uint8Array([1, 2])], "script.exe", { type: "application/x-msdownload" });
    const resMime = validateAndAddAttachments(ok1.attachments, [badMime]);
    expect(resMime.error).toContain("Formato no permitido");
    expect(resMime.attachments).toHaveLength(2);

    const tooBig = new File([new Uint8Array(1)], "pesado.pdf", { type: "application/pdf" });
    Object.defineProperty(tooBig, "size", { value: MAX_CHAT_ATTACHMENT_BYTES + 1 });
    const resBig = validateAndAddAttachments(ok1.attachments, [tooBig]);
    expect(resBig.error).toContain("10 MB");
    expect(resBig.attachments).toHaveLength(2);

    const sixFiles = Array.from({ length: MAX_CHAT_ATTACHMENTS + 1 }, (_, i) =>
      new File([new Uint8Array([i + 1])], `f-${i}.jpg`, { type: "image/jpeg" }));
    const resCount = validateAndAddAttachments([], sixFiles);
    expect(resCount.error).toContain("hasta 5 archivos");

    const draftAttachments: ComposerAttachmentDraft[] = [
      { id: "a1", file: img, fileName: "captura.png", mimeType: "image/png", byteSize: 4096, previewUrl: "blob:captura" },
      { id: "a2", file: pdf, fileName: "propuesta.pdf", mimeType: "application/pdf", byteSize: 2048 },
    ];
    const html = renderToStaticMarkup(
      <Composer writable loading={false} draft="Borrador intacto 🚀" sending={false} failedSend={false}
        attachments={draftAttachments} uploadProgress={65}
        attachmentError="Cada archivo adjunto puede pesar como máximo 10 MB."
        onDraft={vi.fn()} onSend={vi.fn()} />,
    );
    expect(html).toContain('aria-label="Adjuntar archivo"');
    expect(html).toContain('aria-label="Insertar emoji"');
    expect(html).toContain("Borrador intacto 🚀");
    expect(html).toContain('aria-label="Archivos adjuntos pendientes"');
    expect(html).toContain('alt="Vista previa de captura.png"');
    expect(html).toContain("propuesta.pdf");
    expect(html).toContain("4 KB");
    expect(html).toContain('aria-label="Quitar adjunto captura.png"');
    expect(html).toContain('role="progressbar" aria-label="Subiendo archivos adjuntos"');
    expect(html).toContain('aria-valuenow="65"');
    expect(html).toContain("Subiendo adjuntos… 65%");
    expect(html).toContain("Cada archivo adjunto puede pesar como máximo 10 MB.");
  });

  it("muestra indicador accesible «Fulano está escribiendo…» con 3 puntos que se detienen con prefers-reduced-motion", () => {
    const peopleMap = new Map(members.map((m) => [m.id, m]));
    expect(formatTypingIndicator([], peopleMap, "u-self")).toBeNull();
    expect(formatTypingIndicator(["u-self"], peopleMap, "u-self")).toBeNull();
    expect(formatTypingIndicator(["u-ana"], peopleMap, "u-self")).toBe("Ana López está escribiendo…");
    expect(formatTypingIndicator(["u-ana", "u-beto"], peopleMap, "u-self")).toBe("Ana López y Beto Ruiz están escribiendo…");
    expect(TYPING_COOLDOWN_MS).toBe(3000);

    const html = renderToStaticMarkup(
      <Composer writable loading={false} draft="" sending={false} failedSend={false}
        userId="u-self" members={members} typingUserIds={["u-ana"]} onDraft={vi.fn()} onSend={vi.fn()} />,
    );
    expect(html).toContain('role="status" aria-live="polite"');
    expect(html).toContain("Ana López está escribiendo…");
    expect(html.match(/hubly-typing-dot/g)).toHaveLength(3);

    const tokensCss = readFileSync(resolve(__dirname, "../../../packages/ui/src/tokens.css"), "utf8");
    // movimiento.md: los indicadores no se mueven en bucle; los puntos quedan quietos.
    const dotRule = tokensCss.match(/\.hubly-typing-dot \{[^}]*\}/)?.[0] ?? "";
    expect(dotRule).not.toBe("");
    expect(dotRule).not.toContain("animation");
    expect(tokensCss).not.toContain("@keyframes hubly-typing-dot");
  });

  it("reserva dimensiones (width y height) en imágenes del hilo para evitar saltos de diseño y enlaza descarga de PDF", () => {
    expect(formatAttachmentBytes(512)).toBe("512 B");
    expect(formatAttachmentBytes(15360)).toBe("15 KB");
    expect(formatAttachmentBytes(2.5 * 1024 * 1024)).toBe("2.5 MB");

    const attachments: ChatAttachmentItem[] = [
      {
        id: "att-img", fileName: "boceto.webp", mimeType: "image/webp", byteSize: 40_960,
        width: 640, height: 360, url: "https://storage.local/boceto.webp", downloadUrl: "https://storage.local/boceto.webp?download=1",
      },
      {
        id: "att-pdf", fileName: "brief.pdf", mimeType: "application/pdf", byteSize: 524_288,
        url: "https://storage.local/brief.pdf", downloadUrl: "https://storage.local/brief.pdf?download=1",
      },
    ];
    const rootMsg: ThreadMessageView = {
      id: "root-1", conversationId: "general", authorId: "u-ana", body: "Adjunto boceto y brief",
      number: 1, change: 1, sentAt: "2026-11-06T12:00:00.000Z", editedAt: null, deletedAt: null,
      attachments,
    };
    const replyMsg: ThreadMessageView = {
      ...rootMsg, id: "rep-1", authorId: "u-beto", body: "Aquí va versión corregida", number: 2, change: 2,
      threadRootId: "root-1", attachments: [attachments[0]!],
    };

    const html = renderToStaticMarkup(
      <ThreadPanel rootMessage={rootMsg} replies={[replyMsg]} userId="u-self" writable
        people={new Map(members.map((m) => [m.id, m]))} onClose={vi.fn()} />,
    );
    expect(html).toContain('data-attachment-kind="image"');
    expect(html).toContain('data-reserved-width="640"');
    expect(html).toContain('data-reserved-height="360"');
    expect(html).toContain('width="640" height="360"');
    expect(html).toContain('download="boceto.webp"');
    expect(html).toContain('data-attachment-kind="pdf"');
    expect(html).toContain('download="brief.pdf"');
    expect(html).toContain("Descargar PDF");

    const standaloneHtml = renderToStaticMarkup(<ChatAttachmentList attachments={attachments} />);
    expect(standaloneHtml).toContain('aria-label="Archivos adjuntos del mensaje"');
  });

  it("sube adjuntos directos a la signedUrl en cuarentena de Storage (reserve → PUT → commit) sin pasar binarios por la Vercel Function", async () => {
    const bigPdf = new File([new Uint8Array(8), "pdf"], "dossier-10mb.pdf", { type: "application/pdf" });
    Object.defineProperty(bigPdf, "size", { value: MAX_CHAT_ATTACHMENT_BYTES });
    const drafts: ComposerAttachmentDraft[] = [
      { id: "d1", file: bigPdf, fileName: "dossier-10mb.pdf", mimeType: "application/pdf", byteSize: MAX_CHAT_ATTACHMENT_BYTES },
    ];
    const progressSteps: number[] = [];
    const calls: Array<{ url: string; method: string; contentType: string | null; isBinaryBody: boolean }> = [];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      const method = init?.method ?? "GET";
      const headers = new Headers(init?.headers);
      calls.push({ url, method, contentType: headers.get("Content-Type"), isBinaryBody: init?.body instanceof File });
      if (url === "/api/chat/attachments" && typeof init?.body === "string") {
        const parsed = JSON.parse(init.body) as { op: string };
        if (parsed.op === "reserve") {
          return Response.json({ reservations: [{ id: "res-1", signedUrl: "https://storage.local/quarantine/res-1" }] });
        }
        if (parsed.op === "commit") {
          return Response.json({
            attachments: [{
              id: "res-1", fileName: "dossier-10mb.pdf", mimeType: "application/pdf",
              byteSize: MAX_CHAT_ATTACHMENT_BYTES, url: "https://storage.local/final/res-1", downloadUrl: "https://storage.local/final/res-1?download=1",
            }],
          });
        }
      }
      if (url.startsWith("https://storage.local/quarantine/") && method === "PUT") {
        return new Response(null, { status: 200 });
      }
      return new Response(null, { status: 500 });
    });

    const uploaded = await uploadComposerAttachments({
      workspaceId: "ws-1", conversationId: "conv-1", messageId: "msg-1",
      attachments: drafts, fetchImpl: fetchMock as unknown as typeof fetch,
      onProgress: (pct) => progressSteps.push(pct),
    });
    expect(uploaded).toHaveLength(1);
    expect(uploaded[0]?.fileName).toBe("dossier-10mb.pdf");
    expect(calls).toEqual([
      { url: "/api/chat/attachments", method: "POST", contentType: "application/json", isBinaryBody: false },
      { url: "https://storage.local/quarantine/res-1", method: "PUT", contentType: "application/pdf", isBinaryBody: true },
      { url: "/api/chat/attachments", method: "POST", contentType: "application/json", isBinaryBody: false },
    ]);
    expect(progressSteps).toEqual([0, 50, 100]);
  });
});

describe("Compositor conectado en ChatView y opciones de mención accesibles (issue 207)", () => {
  const channel: ChatConversation = {
    id: "general", kind: "channel", slug: "general", peerId: null, archived: false, writable: true, unread: false, changeCursor: 1,
  };
  const viewProps: ChatViewProps = {
    workspaceName: "Agencia de prueba", userId: "u-self", canManage: false, canSend: true, unreadOnly: false,
    conversations: [channel], people: members, currentId: channel.id, messages: [], loading: false,
    hasOlder: false, loadingOlder: false, draft: "Hola @", sending: false, failedSend: false, error: null, notice: null,
    onFilter: vi.fn(), onSelect: vi.fn(), onOlder: vi.fn(), onVisible: vi.fn(), onCommand: vi.fn(), onDraft: vi.fn(), onSend: vi.fn(),
  };
  const listbox = (html: string) => html.match(/<ul id="chat-mention-listbox"[\s\S]*?<\/ul>/)?.[0] ?? "";

  it("ChatView pasa members y userId al compositor: al escribir @ aparecen los compañeros, sin la propia persona", () => {
    const html = renderToStaticMarkup(<ChatView {...viewProps} />);
    const box = listbox(html);
    expect(box).toContain('role="listbox"');
    expect(box).toContain("Ana López");
    expect(box).toContain("Beto Ruiz");
    expect(box).not.toContain("Jair Bonilla");
    expect(html).toContain('aria-activedescendant="chat-mention-opt-u-ana"');
  });

  it("ChatView reenvía al compositor el indicador de escritura y el progreso de subida", () => {
    const html = renderToStaticMarkup(<ChatView {...viewProps} draft="" typingUserIds={["u-ana"]} uploadProgress={40} />);
    expect(html).toContain("Ana López está escribiendo…");
    expect(html).toContain('aria-valuenow="40"');
  });

  it("las opciones del listbox no anidan controles interactivos (sin <button> dentro de role=option)", () => {
    const html = renderToStaticMarkup(
      <Composer writable loading={false} draft="@" sending={false} failedSend={false} userId="u-self" members={members} onDraft={vi.fn()} onSend={vi.fn()} />,
    );
    const box = listbox(html);
    expect(box.match(/role="option"/g)).toHaveLength(3);
    expect(box).not.toContain("<button");
    expect(box).toMatch(/<li[^>]*role="option"[^>]*class="[^"]*cursor-pointer/);
  });

  it("revoca solo las vistas previas blob: al quitar adjuntos o limpiar tras enviar", () => {
    const revoke = vi.fn();
    const original = URL.revokeObjectURL;
    URL.revokeObjectURL = revoke;
    try {
      revokePreviewUrl("blob:http://localhost:3101/abc");
      revokePreviewUrl("https://storage.test/foto.png");
      revokePreviewUrl(null);
      expect(revoke).toHaveBeenCalledTimes(1);
      expect(revoke).toHaveBeenCalledWith("blob:http://localhost:3101/abc");
    } finally {
      URL.revokeObjectURL = original;
    }
    const source = readFileSync(resolve(__dirname, "../src/components/chat/Composer.tsx"), "utf8");
    expect(source).toMatch(/function removeAttachment[\s\S]*?revokeAttachmentPreview\(removed\)/);
    expect(source).toMatch(/activeAttachments\.forEach\(revokeAttachmentPreview\);\s*setLocalAttachments\(\[\]\)/);
  });
});

describe("Adjuntos ocultos mientras los mensajes no los muestran (Constitución: nada se simula)", () => {
  it("con attachmentsEnabled={false} no hay botón ni selector de archivos", () => {
    const html = renderToStaticMarkup(
      <Composer writable loading={false} draft="" sending={false} failedSend={false} attachmentsEnabled={false} onDraft={vi.fn()} onSend={vi.fn()} />,
    );
    expect(html).not.toContain("Adjuntar archivo");
    expect(html).not.toContain('type="file"');
  });

  it("con attachmentsEnabled={false} no muestra fichas de adjuntos ni habilita «Enviar» sin texto", () => {
    const pending: ComposerAttachmentDraft[] = [{ id: "a1", file: new File([], "foto.png"), fileName: "foto.png", mimeType: "image/png", byteSize: 1200 }];
    const html = renderToStaticMarkup(
      <Composer writable loading={false} draft="" sending={false} failedSend={false} attachmentsEnabled={false}
        attachments={pending} onDraft={vi.fn()} onSend={vi.fn()} />,
    );
    expect(html).not.toContain("Archivos adjuntos pendientes");
    expect(html).not.toContain("foto.png");
    expect(html).toMatch(/<button[^>]*type="submit"[^>]*disabled/);
  });

  it("con adjuntos activos y error de subida ofrece reintentar la subida (issue 259)", () => {
    const html = renderToStaticMarkup(
      <Composer writable loading={false} draft="" sending={false} failedSend={false}
        attachmentError="No se pudo registrar los archivos adjuntos." onRetryAttachmentUpload={() => {}}
        onDraft={vi.fn()} onSend={vi.fn()} />,
    );
    expect(html).toContain("No se pudo registrar los archivos adjuntos.");
    expect(html).toContain("Reintentar subida");
  });
});

describe("Menciones guardadas con el borrador de ChatScreen (issue 207)", () => {
  it("solo envía menciones del directorio cuyo @Nombre sigue en el texto", () => {
    const body = "Hola @Ana López, ¿lo ves?";
    expect(mentionsToSend(["u-ana", "u-beto", "u-desconocido"], members, body)).toEqual(["u-ana"]);
  });

  it("un envío fallido conserva menciones y clave para que el reintento las lleve", () => {
    const failed = draftAfterSend("Hola @Ana López", "clave-1", ["u-ana"], false);
    expect(failed).toEqual({ text: "Hola @Ana López", key: "clave-1", sending: false, failed: true, mentions: ["u-ana"] });
    // El reintento usa las menciones del borrador fallido.
    expect(mentionsToSend(failed.mentions ?? [], members, failed.text)).toEqual(["u-ana"]);
    expect(draftAfterSend("Hola @Ana López", "clave-1", ["u-ana"], true)).toEqual({ text: "", sending: false, failed: false });
  });
});

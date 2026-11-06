import type { ChatParticipant } from "@hubly/contracts";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { ChatAttachmentList, formatAttachmentBytes, type ChatAttachmentItem } from "../src/components/chat/ChatAttachmentView";
import {
  Composer, MAX_CHAT_ATTACHMENT_BYTES, MAX_CHAT_ATTACHMENTS, TYPING_COOLDOWN_MS,
  applyMentionSelection, detectMentionQuery, filterMentionCandidates, formatTypingIndicator,
  validateAndAddAttachments, type ComposerAttachmentDraft,
} from "../src/components/chat/Composer";
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
    expect(tokensCss).toContain("@keyframes hubly-typing-dot");
    expect(tokensCss).toMatch(/@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.hubly-typing-dot[\s\S]*animation:\s*none/);
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
});

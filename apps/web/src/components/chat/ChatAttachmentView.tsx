"use client";

import React from "react";

export interface ChatAttachmentItem {
  id: string;
  fileName: string;
  mimeType: string;
  byteSize: number;
  width?: number | null | undefined;
  height?: number | null | undefined;
  url?: string | null | undefined;
  downloadUrl?: string | null | undefined;
}

export function formatAttachmentBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ChatAttachmentList({ attachments }: { attachments?: readonly ChatAttachmentItem[] | undefined }) {
  if (!attachments?.length) return null;
  return (
    <div aria-label="Archivos adjuntos del mensaje" className="mt-2 flex flex-col gap-2">
      {attachments.map((item) => {
        const isImage = item.mimeType.startsWith("image/");
        const w = item.width && item.width > 0 ? item.width : 320;
        const h = item.height && item.height > 0 ? item.height : 200;
        const href = item.downloadUrl ?? item.url ?? "";
        if (isImage) {
          return (
            <figure key={item.id} data-attachment-kind="image" data-reserved-width={w} data-reserved-height={h}
              className="overflow-hidden rounded-xl border border-(--border-subtle) bg-(--surface-sunken) p-2">
              <div className="overflow-hidden rounded-lg bg-(--surface-canvas)">
                <img src={item.url ?? ""} alt={item.fileName} width={w} height={h} loading="lazy"
                  className="block max-h-60 w-full object-contain" />
              </div>
              <figcaption className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs text-(--text-secondary)">
                <span className="truncate font-medium text-(--text-primary)">{item.fileName}</span>
                <div className="flex items-center gap-2">
                  <span>{formatAttachmentBytes(item.byteSize)}</span>
                  {href && (
                    <a href={href} download={item.fileName} aria-label={`Descargar ${item.fileName}`}
                      className="font-semibold text-(--accent-primary) underline-offset-2 hover:underline">
                      Descargar
                    </a>
                  )}
                </div>
              </figcaption>
            </figure>
          );
        }
        return (
          <div key={item.id} data-attachment-kind="pdf"
            className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-(--border-subtle) bg-(--surface-sunken) px-3 py-2 text-xs">
            <div className="flex min-w-0 items-center gap-2">
              <span className=" shrink-0 rounded-md bg-(--accent-primary-subtle) px-1.5 py-0.5 font-semibold text-(--accent-primary)">PDF</span>
              <span className="truncate font-medium text-(--text-primary)">{item.fileName}</span>
              <span className="shrink-0 text-(--text-muted)">{formatAttachmentBytes(item.byteSize)}</span>
            </div>
            {href && (
              <a href={href} download={item.fileName} aria-label={`Descargar ${item.fileName}`}
                className="font-semibold text-(--accent-primary) underline-offset-2 hover:underline">
                Descargar PDF
              </a>
            )}
          </div>
        );
      })}
    </div>
  );
}

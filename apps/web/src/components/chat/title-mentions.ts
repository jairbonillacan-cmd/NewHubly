const stripTitlePrefix = (title: string): string => title.replace(/^\(\d+\)\s*/, "").trim() || "Hubly";

export function formatDocumentTitleWithMentions(baseTitle: string, unreadMentionsCount: number): string {
  const clean = stripTitlePrefix(baseTitle);
  const count = Math.max(0, Math.floor(unreadMentionsCount));
  return count > 0 ? `(${count}) ${clean}` : clean;
}

export function syncDocumentTitleMentions(
  doc: { title: string } | null | undefined,
  unreadMentionsCount: number,
): () => void {
  if (!doc) return () => {};
  const baseTitle = stripTitlePrefix(doc.title);
  doc.title = formatDocumentTitleWithMentions(baseTitle, unreadMentionsCount);
  return () => {
    doc.title = baseTitle;
  };
}

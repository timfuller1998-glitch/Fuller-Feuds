/** Paragraphs = blocks separated by a blank line (one or more newlines with optional spaces). */
export type TextSegment = {
  index: number;
  text: string;
};

export function splitIntoParagraphs(text: string): TextSegment[] {
  const normalized = (text || "").replace(/\r\n/g, "\n");
  const trimmed = normalized.trim();
  if (!trimmed) return [];

  const parts = trimmed
    .split(/\n(?:\s*\n)+/)
    .map((p) => (typeof p === "string" ? p.trim() : ""))
    .filter(Boolean);

  return parts.map((p, idx) => ({ index: idx, text: p }));
}

/** Paragraph index matches `InteractiveSentenceText` with `segmentMode="paragraph"`. */
export function getParagraphTextAtIndex(content: string | undefined | null, paragraphIndex: number): string {
  const paras = splitIntoParagraphs(content ?? "");
  return paras[paragraphIndex]?.text ?? "";
}

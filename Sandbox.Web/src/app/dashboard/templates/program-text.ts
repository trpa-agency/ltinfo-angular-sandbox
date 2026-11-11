// Program text arrives from LT Info as plain text, with a blank line between paragraphs.

/** The paragraphs of a description or approach. Null, empty, and whitespace-only text give none. */
export function paragraphs(text: string | null | undefined): string[] {
  return (text ?? '')
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

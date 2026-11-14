// Program text arrives from LT Info as plain text, with a blank line between paragraphs.

/** The paragraphs of a description or approach. Null, empty, and whitespace-only text give none. */
export function paragraphs(text: string | null | undefined): string[] {
  return (text ?? '')
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph.trim())
    .filter((paragraph) => paragraph.length > 0);
}

/** The longest first paragraph, in characters, that is shown as the lead in a header. */
export const LEAD_MAX_LENGTH = 320;

/**
 * The first paragraph when it can stand alone under the program name: a short statement
 * that ends a sentence. A question ("What are Harmful Algal Blooms?") or a line with no
 * closing period is a heading the author typed into the description; shown alone it would
 * leave the header asking something it does not answer, so it stays in the story.
 */
export function leadParagraph(description: readonly string[]): string | null {
  const first = description[0];
  if (!first || first.length > LEAD_MAX_LENGTH) return null;
  return /[.!]["'\u2019\u201d)]?$/.test(first) ? first : null;
}

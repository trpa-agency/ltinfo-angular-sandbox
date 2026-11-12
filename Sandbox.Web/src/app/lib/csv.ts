/*
 * csv.ts: RFC 4180 CSV from rows and columns, and rows from CSV text. Pure, no DOM. The download step
 * (Blob plus an anchor click) lives in the component that owns the button.
 */

export interface CsvColumn {
  /** Row key. */
  field: string;
  /** Header text. */
  headerName: string;
}

/** One field, quoted when it holds a comma, a quote, or a line break. Quotes are doubled. */
export function csvField(v: unknown): string {
  if (v == null) return '';
  let s: string;
  if (typeof v === 'string') s = v;
  else if (typeof v === 'number') s = Number.isFinite(v) ? String(v) : '';
  else s = String(v);
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** CSV text with a header row, CRLF line endings, and a trailing line break. */
export function toCsv(columns: CsvColumn[], rows: Record<string, unknown>[]): string {
  const lines: string[] = [columns.map((c) => csvField(c.headerName)).join(',')];
  for (const r of rows) lines.push(columns.map((c) => csvField(r[c.field])).join(','));
  return `${lines.join('\r\n')}\r\n`;
}

/** Lowercase, ASCII letters and digits, hyphens between words. */
export function slugify(s: string): string {
  const slug = s
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'data';
}

/** File name from the parts that identify the data: program, title, and picked value. */
export function csvFileName(parts: (string | number | null | undefined)[]): string {
  return `${slugify(parts.filter((p) => p != null && p !== '').join(' '))}.csv`;
}

/**
 * Rows from CSV text with a header row: one object per line keyed by header. Quoted fields may
 * hold commas, doubled quotes, and line breaks. A field that is a plain number becomes a number;
 * an empty field becomes null. Blank lines are skipped.
 */
export function parseCsv(text: string): Record<string, string | number | null>[] {
  const records: string[][] = [];
  let record: string[] = [];
  let field = '';
  let quoted = false;
  const src = text.replace(/^\uFEFF/, '');
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ',') {
      record.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && src[i + 1] === '\n') i++;
      record.push(field);
      records.push(record);
      record = [];
      field = '';
    } else field += c;
  }
  if (field !== '' || record.length) {
    record.push(field);
    records.push(record);
  }
  const [header, ...lines] = records.filter((r) => r.some((v) => v.trim() !== ''));
  if (!header) return [];
  const names = header.map((h) => h.trim());
  return lines.map((line) =>
    Object.fromEntries(
      names.map((name, j) => {
        const raw = (line[j] ?? '').trim();
        if (raw === '') return [name, null];
        return [name, /^-?\d+(\.\d+)?([eE][-+]?\d+)?$/.test(raw) ? Number(raw) : raw];
      }),
    ),
  );
}

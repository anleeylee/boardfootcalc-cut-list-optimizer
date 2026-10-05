/**
 * csv.ts — RFC-4180 CSV parsing/serialization plus header mapping helpers.
 *
 * Handles quoted fields, embedded commas/newlines, BOM, auto delimiter
 * detection (comma / semicolon / tab), and European comma decimals
 * ("7,56" -> 7.56) — common on European lumber invoices.
 */

export interface CsvParseOptions {
  delimiter?: ',' | ';' | '\t';
  /** Auto-detect delimiter when not given. */
  autoDetect?: boolean;
}

export function detectDelimiter(text: string): ',' | ';' | '\t' {
  const head = text.slice(0, 4096);
  const candidates = [',', ';', '\t'] as const;
  let best: ',' | ';' | '\t' = ',';
  let bestScore = -1;
  for (const c of candidates) {
    // Count delimiter occurrences outside quoted regions (approximate but robust).
    let count = 0;
    let inQuotes = false;
    for (let i = 0; i < head.length; i++) {
      const ch = head[i];
      if (ch === '"') inQuotes = !inQuotes;
      else if (ch === c && !inQuotes) count++;
    }
    if (count > bestScore) {
      bestScore = count;
      best = c;
    }
  }
  return best;
}

/** Parse CSV text into rows of string cells. */
export function parseCSV(text: string, opts: CsvParseOptions = {}): string[][] {
  const src = text.replace(/^\uFEFF/, '');
  const delimiter = opts.delimiter ?? (opts.autoDetect === false ? ',' : detectDelimiter(src));
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          field += '"';
          i += 2;
        } else {
          inQuotes = false;
          i += 1;
        }
      } else {
        field += ch;
        i += 1;
      }
    } else if (ch === '"') {
      inQuotes = true;
      i += 1;
    } else if (ch === delimiter) {
      row.push(field);
      field = '';
      i += 1;
    } else if (ch === '\r') {
      // CRLF: skip the CR, handle LF next iteration; lone CR also ends the row.
      if (src[i + 1] === '\n') i += 1;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      i += 1;
    } else if (ch === '\n') {
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
      i += 1;
    } else {
      field += ch;
      i += 1;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim() !== ''));
}

/** Serialize rows to CSV. */
export function toCSV(rows: (string | number | null | undefined)[][]): string {
  return rows
    .map((row) =>
      row
        .map((cell) => {
          const s = cell === null || cell === undefined ? '' : String(cell);
          if (/[",\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
          return s;
        })
        .join(','),
    )
    .join('\r\n');
}

/** Parse a decimal that may use a comma as the decimal separator. */
export function parseDecimal(value: string | number): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  const text = value.trim().replace(/\s+/g, '');
  if (text === '') return null;
  // "1,234.5" is a thousands-separated number -> keep as-is.
  if (/^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(text)) {
    const n = Number(text.replace(/,/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  // "7,56" -> 7.56  (comma decimal, no thousands grouping)
  if (/^-?\d+,\d+$/.test(text)) {
    const n = Number(text.replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  }
  const n = Number(text.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** Strip non-alphanumeric characters and lowercase — for header matching. */
export function normalizeHeader(header: string): string {
  return header.toLowerCase().replace(/[^a-z0-9]/g, '');
}

export type HeaderMap = Record<string, string>;

/**
 * Map incoming CSV headers to canonical field names using synonyms.
 * Returns the mapping plus a list of canonical fields that could NOT be mapped.
 */
export function mapHeaders(
  headers: string[],
  synonyms: Record<string, string[]>,
): { mapping: HeaderMap; unmapped: string[]; unknown: string[] } {
  const canonical = Object.keys(synonyms);
  const mapping: HeaderMap = {};
  const used = new Set<string>();
  for (const header of headers) {
    const norm = normalizeHeader(header);
    let found: string | null = null;
    for (const [canon, aliases] of Object.entries(synonyms)) {
      if (used.has(canon)) continue;
      if (norm === normalizeHeader(canon) || aliases.some((a) => normalizeHeader(a) === norm)) {
        found = canon;
        break;
      }
    }
    if (found) {
      mapping[found] = header;
      used.add(found);
    } else if (norm !== '') {
      mapping[norm] = header;
    }
  }
  const unmapped = canonical.filter((c) => !used.has(c));
  const unknown = headers.filter((h) => !Object.values(mapping).includes(h) && normalizeHeader(h) !== '');
  return { mapping, unmapped, unknown };
}

/** Cell lookup: returns the mapped column value for a row, trimmed to string. */
export function cell(row: Record<string, unknown>, headerMap: HeaderMap, field: string): string {
  const col = headerMap[field];
  if (!col) return '';
  const v = row[col];
  return v === undefined || v === null ? '' : String(v).trim();
}

export function firstLine(text: string): string {
  const idx = text.indexOf('\n');
  return (idx === -1 ? text : text.slice(0, idx)).replace(/^\uFEFF/, '');
}

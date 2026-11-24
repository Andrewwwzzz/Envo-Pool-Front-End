// Table number a member types for an F&B order ("3", "T3", "Table 3") — shared by the F&B page and
// the Rewards page, so food ordered either way reaches staff with the table on it (owner, 16/24 Nov 2026).

export const MAX_TABLE = 14;

/** "3" / "t3" → "Table 3"; anything else is kept as typed (trimmed). */
export function normalizeTableName(input: string): string {
  const v = input.trim();
  if (!v) return v;
  if (/^[Tt]\d+$/.test(v)) return `Table ${v.replace(/^[Tt]/, "")}`;
  if (/^\d+$/.test(v)) return `Table ${v}`;
  return v;
}

function extractTableNumber(input: string): number | null {
  const m = input.trim().match(/^(?:[Tt]able\s*)?(\d+)$/i);
  return m ? parseInt(m[1]) : null;
}

/** A real table: 1 to MAX_TABLE. */
export function isValidTable(input: string): boolean {
  const n = extractTableNumber(input);
  return n !== null && n >= 1 && n <= MAX_TABLE;
}

// utils/ScriptUtils/search.ts
export type Match = { start: number; end: number };

export function escapeRegExp(s: string) {
  // Escapa caràcters regex per fer cerca literal
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function findMatches(haystack: string, needle: string, opts?: { caseSensitive?: boolean }): Match[] {
  if (!needle) return [];
  const pattern = escapeRegExp(needle);
  const flags = opts?.caseSensitive ? "g" : "gi";
  const re = new RegExp(pattern, flags);
  const out: Match[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(haystack))) {
    out.push({ start: m.index, end: m.index + m[0].length });
    if (m.index === re.lastIndex) re.lastIndex++; // evitar bucle en matches buits
  }
  return out;
}

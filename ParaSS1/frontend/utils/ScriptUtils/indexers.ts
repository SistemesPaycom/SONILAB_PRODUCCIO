// utils/ScriptUtils/indexers.ts
export interface CharacterInfo {
  name: string;
  count: number;
}

export interface TakeInfo {
  num: number;
  start: number;
  end: number;
}

export function indexCharacters(text: string): CharacterInfo[] {
  const regex = /\*([^\*\n]{1,40}?)\*/g;
  const counts = new Map<string, number>();

  let match;
  while ((match = regex.exec(text)) !== null) {
    const raw = match[1].trim();
    if (!raw) continue;

    const name = raw.toUpperCase();

    if (name.length < 2) continue;
    if (/^\d+$/.test(name)) continue;
    if (name.includes('(') || name.includes(')')) continue;

    counts.set(name, (counts.get(name) || 0) + 1);
  }
  
  const result: CharacterInfo[] = Array.from(counts.entries()).map(([name, count]) => ({
    name,
    count,
  }));
  
  result.sort((a, b) => a.name.localeCompare(b.name));
  
  return result;
}

export function indexTakes(text: string): TakeInfo[] {
  const regex = /TAKE\s*#\s*(\d+)/gi;
  const takes: TakeInfo[] = [];
  
  let match;
  while ((match = regex.exec(text)) !== null) {
    const num = parseInt(match[1], 10);
    const start = match.index;
    takes.push({ num, start, end: text.length });
  }
  
  takes.sort((a, b) => a.start - b.start);
  
  for (let i = 0; i < takes.length - 1; i++) {
    takes[i].end = takes[i + 1].start;
  }
  
  return takes;
}
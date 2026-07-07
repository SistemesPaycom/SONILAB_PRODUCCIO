// utils/SubtitlesEditor/searchReplace.ts

/**
 * Cerca i substitució LITERAL sobre el text visible dels subtítols SRT.
 * - "Text visible" = el text sense cap seqüència <...> (criteri idèntic a
 *   textMetrics.stripSrtTags), amb U+00A0 normalitzat a espai i amb \n com a caràcter.
 * - Tots els offsets són unitats UTF-16 (índexs de string JS), coherents amb el DOM.
 * - La substitució opera sobre un model de caràcters amb pila de tags canònics
 *   (<b>/<i>/<u>): el text inserit hereta la pila del primer caràcter substituït
 *   (criteri Word). La re-serialització balanceja tags per línia i mai emet parells buits.
 * Funcions pures: sense DOM, sense React (verificables de manera aïllada).
 */

export interface SearchOptions {
  caseSensitive: boolean;
  wholeWord: boolean;
}

/** Coincidència en offsets de TEXT VISIBLE del segment. */
export interface SegmentMatch {
  segmentId: number;
  segmentIndex: number;
  start: number;
  end: number;
}

const TOKEN_RE = /<[^>]*>/g;
const CANONICAL_RE = /^<(\/?)([biu])>$/i;
const WORD_CHAR_RE = /[\p{L}\p{N}]/u;

/** Text visible d'un text SRT cru: treu tot <...>, normalitza U+00A0 → espai. Conserva \n. */
export function toVisibleText(raw: string): string {
  if (!raw) return '';
  return raw.replace(TOKEN_RE, '').replace(/\u00A0/g, ' ');
}

/**
 * Case folding segur per a offsets: minúscula caràcter a caràcter (per code point),
 * conservant el caràcter original si el fold canviés la longitud UTF-16 (casos exòtics
 * tipus 'İ'). Garanteix |fold(s)| === |s| → els offsets del text foldejat valen per a l'original.
 */
function foldForSearch(s: string): string {
  let out = '';
  for (const ch of s) {
    const low = ch.toLowerCase();
    out += low.length === ch.length ? low : ch;
  }
  return out;
}

/** Coincidències literals dins d'un text visible, sense solapaments (avança per `end`). */
export function findMatchesInText(
  visible: string,
  query: string,
  opts: SearchOptions
): Array<{ start: number; end: number }> {
  const res: Array<{ start: number; end: number }> = [];
  if (!query) return res;
  // El query pot dur U+00A0 (p. ex. prefill des del DOM que genera plainToRich amb &nbsp;):
  // normalitzar-lo igual que el text visible. Mateixa longitud → offsets intactes.
  const q = query.replace(/\u00A0/g, ' ');
  const hay = opts.caseSensitive ? visible : foldForSearch(visible);
  const needle = opts.caseSensitive ? q : foldForSearch(q);
  const isWordChar = (ch: string | undefined) => !!ch && WORD_CHAR_RE.test(ch);
  let from = 0;
  for (;;) {
    const i = hay.indexOf(needle, from);
    if (i === -1) break;
    const end = i + needle.length;
    if (!opts.wholeWord || (!isWordChar(visible[i - 1]) && !isWordChar(visible[end]))) {
      res.push({ start: i, end });
      from = end;
    } else {
      from = i + 1;
    }
  }
  return res;
}

/** Coincidències de tot el document, en ordre (índex de segment, offset). */
export function findMatches(
  segments: Array<{ id: number; originalText: string }>,
  query: string,
  opts: SearchOptions
): SegmentMatch[] {
  const out: SegmentMatch[] = [];
  if (!query) return out;
  segments.forEach((seg, segmentIndex) => {
    const visible = toVisibleText(seg.originalText || '');
    for (const m of findMatchesInText(visible, query, opts)) {
      out.push({ segmentId: seg.id, segmentIndex, start: m.start, end: m.end });
    }
  });
  return out;
}

// ── Model de caràcters (base de la substitució amb herència de format) ──

interface VisChar {
  ch: string;        // 1 unitat UTF-16 (U+00A0 del text original ja normalitzat a espai; els caràcters inserits per replacement es mantenen tal qual)
  stack: string[];   // pila EFECTIVA de tags canònics oberts (sense duplicats, ordre d'obertura)
  pre: string[];     // tokens opacs (<font …>, etc.) ancorats just abans d'aquest caràcter
}

interface CharModel {
  chars: VisChar[];
  trailing: string[]; // tokens opacs després de l'últim caràcter visible
}

/**
 * Un únic recorregut amb /<[^>]*>/g. Tags canònics (case-insensitive) mantenen una
 * pila amb repeticions (un <i> niat dins d'un altre no perd la cursiva en tancar-ne un);
 * la pila efectiva per caràcter es dedueix sense duplicats. Un tag obert sense tancar
 * cobreix fins al final (mateixa tolerància que formatTags.isFullyTagged).
 * Qualsevol altre token <...> es conserva com a opac, ancorat al caràcter visible següent.
 */
function parseCharModel(raw: string): CharModel {
  const chars: VisChar[] = [];
  let pending: string[] = [];
  const rawStack: string[] = [];
  let effective: string[] = [];
  const recompute = () => {
    effective = rawStack.filter((t, i) => rawStack.indexOf(t) === i);
  };
  const pushText = (text: string) => {
    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      chars.push({ ch: c === '\u00A0' ? ' ' : c, stack: effective, pre: pending });
      pending = [];
    }
  };
  const re = new RegExp(TOKEN_RE.source, 'g');
  let lastIndex = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    pushText(raw.slice(lastIndex, m.index));
    const tok = m[0];
    const cm = CANONICAL_RE.exec(tok);
    if (cm) {
      const tag = cm[2].toLowerCase();
      if (cm[1] === '/') {
        const at = rawStack.lastIndexOf(tag);
        if (at !== -1) rawStack.splice(at, 1);
      } else {
        rawStack.push(tag);
      }
      recompute();
    } else {
      pending.push(tok);
    }
    lastIndex = m.index + tok.length;
  }
  pushText(raw.slice(lastIndex));
  return { chars, trailing: pending };
}

/**
 * Re-serialitza el model: obre/tanca tags canònics quan la pila canvia entre caràcters
 * consecutius; el \n força pila buida per a ell mateix → forma per-línia
 * (<i>l1</i>\n<i>l2</i>), la mateixa convenció que formatTags.wrapTagPerLine.
 * Els tokens opacs s'emeten a la seva àncora (entre els tancaments i les obertures).
 * Mai s'emeten parells buits: els tags només s'obren quan hi ha un caràcter a dins.
 */
function serializeCharModel(model: CharModel): string {
  let out = '';
  let open: string[] = [];
  for (const c of model.chars) {
    const target = c.ch === '\n' ? [] : c.stack;
    let common = 0;
    while (common < open.length && common < target.length && open[common] === target[common]) common++;
    for (let i = open.length - 1; i >= common; i--) out += `</${open[i]}>`;
    open = open.slice(0, common);
    for (const tok of c.pre) out += tok;
    for (let i = common; i < target.length; i++) {
      out += `<${target[i]}>`;
      open.push(target[i]);
    }
    out += c.ch;
  }
  for (let i = open.length - 1; i >= 0; i--) out += `</${open[i]}>`;
  for (const tok of model.trailing) out += tok;
  return out;
}

/**
 * Substitueix el rang visible [start, end) del text CRU per `replacement` (text pla).
 * Els caràcters inserits hereten la pila de tags del PRIMER caràcter substituït.
 * Els tokens opacs ancorats a caràcters eliminats es re-ancoren al primer caràcter
 * supervivent posterior (o al final). El segment re-serialitzat queda normalitzat
 * (tags balancejats, forma per-línia) — només canvia el segment substituït.
 */
export function replaceVisibleRange(raw: string, start: number, end: number, replacement: string): string {
  const model = parseCharModel(raw);
  const stack = model.chars[start] ? model.chars[start].stack : [];
  const carried = model.chars.slice(start, end).flatMap(c => c.pre);
  const inserted: VisChar[] = [];
  for (let i = 0; i < replacement.length; i++) {
    inserted.push({ ch: replacement[i], stack, pre: i === 0 ? carried : [] });
  }
  const chars = [...model.chars.slice(0, start), ...inserted, ...model.chars.slice(end)];
  let trailing = model.trailing;
  if (inserted.length === 0 && carried.length > 0) {
    const next = chars[start];
    if (next) chars[start] = { ...next, pre: [...carried, ...next.pre] };
    else trailing = [...carried, ...trailing];
  }
  return serializeCharModel({ chars, trailing });
}

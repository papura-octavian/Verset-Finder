// Parserul comun pentru subsetul de markdown al predicilor — O SINGURĂ gramatică
// pentru toate ieșirile: randarea React (Markdown.jsx), exportul .docx și .pdf.
// Subsetul (exact ce produce toolbar-ul editorului):
//   # ## ### titluri · **bold** · *italic* / _italic_ · - listă · 1. listă
//   (indentate cu Tab = sub-puncte) · > citat (folosit pentru versete)
//   · --- separator (și pauză între slide-uri în modul prezentare)
//   · paragrafe separate prin linii goale; o linie nouă simplă rămâne linie nouă,
//     ca în editor (cine scrie o predică nu se așteaptă ca rândurile să se lipească).

// **bold**, *italic*, _italic_ — fără imbricare (suficient pentru editor).
const INLINE_RE = /\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_/;

/**
 * Textul unei linii → secvență de „runs":
 *   „**b** și *i*" → [{text:'b',bold:true}, {text:' și '}, {text:'i',italic:true}]
 */
export function parseInline(text) {
  const runs = [];
  let rest = text;
  while (rest) {
    const m = rest.match(INLINE_RE);
    if (!m) {
      runs.push({ text: rest });
      break;
    }
    if (m.index > 0) runs.push({ text: rest.slice(0, m.index) });
    if (m[1] != null) runs.push({ text: m[1], bold: true });
    else runs.push({ text: m[2] ?? m[3], italic: true });
    rest = rest.slice(m.index + m[0].length);
  }
  return runs;
}

// Element de listă: indentare, apoi „- ", „* " sau „3. " / „3) ".
const LIST_RE = /^(\s*)(?:([-*])|(\d+)[.)])\s+(.*)$/;
const HR_RE = /^\s*(-{3,}|\*{3,})\s*$/;

/** Indentarea (în spații, Tab = 2) → nivelul de imbricare. */
function levelOf(indent) {
  return Math.min(4, Math.floor(indent.replace(/\t/g, '  ').length / 2));
}

/**
 * Întreg documentul → listă de blocuri:
 *   { type:'h', level:1|2|3, inlines }
 *   { type:'quote', paras: [inlines] }   — un element per linie de citat
 *   { type:'list', items: [{ inlines, level, ordered, num }] }
 *   { type:'hr' }
 *   { type:'p', inlines }                 — liniile unite prin runs { br:true }
 */
export function parseBlocks(text) {
  const lines = (text || '').split('\n');
  const out = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    // Separator (înaintea listelor: „---" nu e un element de listă).
    if (HR_RE.test(line)) {
      out.push({ type: 'hr' });
      i++;
      continue;
    }

    // Titluri (#, ##, ###)
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      out.push({ type: 'h', level: h[1].length, inlines: parseInline(h[2]) });
      i++;
      continue;
    }

    // Citat (>) — folosit pentru versetele inserate.
    if (/^>/.test(line)) {
      const paras = [];
      while (i < lines.length && /^>/.test(lines[i])) {
        paras.push(parseInline(lines[i].replace(/^>\s?/, '')));
        i++;
      }
      out.push({ type: 'quote', paras });
      continue;
    }

    // Liste (cu puncte sau numerotate), inclusiv sub-puncte indentate.
    if (LIST_RE.test(line)) {
      const items = [];
      while (i < lines.length && LIST_RE.test(lines[i]) && !HR_RE.test(lines[i])) {
        const m = lines[i].match(LIST_RE);
        items.push({
          inlines: parseInline(m[4]),
          level: levelOf(m[1]),
          ordered: m[3] != null,
          num: m[3] != null ? Number(m[3]) : null,
        });
        i++;
      }
      out.push({ type: 'list', items });
      continue;
    }

    // Paragraf: liniile consecutive obișnuite, cu rândurile noi păstrate.
    const inlines = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,3}\s|>)/.test(lines[i]) &&
      !LIST_RE.test(lines[i]) &&
      !HR_RE.test(lines[i])
    ) {
      if (inlines.length) inlines.push({ text: '\n', br: true });
      inlines.push(...parseInline(lines[i].trim()));
      i++;
    }
    out.push({ type: 'p', inlines });
  }

  return out;
}

/** Titlurile documentului (pentru cuprins), cu linia pe care se află fiecare. */
export function outline(text) {
  const res = [];
  (text || '').split('\n').forEach((line, n) => {
    // Aceeași regulă ca parseBlocks, ca indexul i să corespundă titlului i din previzualizare.
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) res.push({ level: h[1].length, title: h[2].replace(/[*_]/g, '').trim() || '(fără titlu)', line: n });
  });
  return res;
}

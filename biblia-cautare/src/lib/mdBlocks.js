// Parserul comun pentru subsetul de markdown al predicilor — O SINGURĂ gramatică
// pentru toate ieșirile: randarea React (Markdown.jsx), exportul .docx și .pdf.
// Subsetul (exact ce produce toolbar-ul editorului):
//   # ## ### titluri · **bold** · *italic* / _italic_ · - listă · 1. listă
//   > citat (folosit pentru versete) · paragrafe separate prin linii goale

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

/**
 * Întreg documentul → listă de blocuri:
 *   { type:'h', level:1|2|3, inlines }
 *   { type:'quote', paras: [inlines] }   — un element per linie de citat
 *   { type:'ul'|'ol', items: [inlines] }
 *   { type:'p', inlines }
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

    // Listă neordonată (- sau *)
    if (/^[-*]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push(parseInline(lines[i].replace(/^[-*]\s+/, '')));
        i++;
      }
      out.push({ type: 'ul', items });
      continue;
    }

    // Listă ordonată (1. / 1))
    if (/^\d+[.)]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+[.)]\s/.test(lines[i])) {
        items.push(parseInline(lines[i].replace(/^\d+[.)]\s+/, '')));
        i++;
      }
      out.push({ type: 'ol', items });
      continue;
    }

    // Paragraf: liniile consecutive obișnuite, unite cu spațiu.
    const para = [];
    while (
      i < lines.length &&
      lines[i].trim() &&
      !/^(#{1,3}\s|>|[-*]\s|\d+[.)]\s)/.test(lines[i])
    ) {
      para.push(lines[i]);
      i++;
    }
    out.push({ type: 'p', inlines: parseInline(para.join(' ')) });
  }

  return out;
}

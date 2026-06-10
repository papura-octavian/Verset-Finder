// Mini-renderer de markdown pentru predici — fără dependențe, fără HTML injectat
// (construiește direct elemente React, deci nu există risc de injecție).
// Subsetul suportat — exact ce produce toolbar-ul editorului:
//   # ## ### titluri · **bold** · *italic* / _italic_ · - listă · 1. listă
//   > citat (folosit pentru versete) · paragrafe separate prin linii goale
// Titlurile au mărimi relative (em), ca totul să scaleze cu font-size-ul
// containerului (previzualizare normală vs. modul prezentare).

export default function Markdown({ text, className = '' }) {
  return <div className={className}>{renderBlocks(text || '')}</div>;
}

const H_CLS = {
  1: 'mt-6 mb-3 text-[1.6em] font-bold leading-tight first:mt-0',
  2: 'mt-5 mb-2 text-[1.35em] font-bold leading-tight first:mt-0',
  3: 'mt-4 mb-2 text-[1.15em] font-semibold leading-tight first:mt-0',
};

function renderBlocks(text) {
  const lines = text.split('\n');
  const out = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (!line.trim()) {
      i++;
      continue;
    }

    // Titluri (#, ##, ###)
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      const level = h[1].length;
      const Tag = `h${level}`;
      out.push(
        <Tag key={key++} className={H_CLS[level]}>
          {inline(h[2])}
        </Tag>
      );
      i++;
      continue;
    }

    // Citat (>) — folosit pentru versetele inserate.
    if (/^>/.test(line)) {
      const quote = [];
      while (i < lines.length && /^>/.test(lines[i])) {
        quote.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      out.push(
        <blockquote
          key={key++}
          className="my-3 space-y-1 rounded-r-md border-l-4 border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-500/60 dark:bg-amber-400/10"
        >
          {quote.map((q, qi) => (
            <p key={qi} className="leading-relaxed">
              {inline(q)}
            </p>
          ))}
        </blockquote>
      );
      continue;
    }

    // Listă neordonată (- sau *)
    if (/^[-*]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^[-*]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^[-*]\s+/, ''));
        i++;
      }
      out.push(
        <ul key={key++} className="my-2 list-disc space-y-1 pl-6">
          {items.map((it, ii) => (
            <li key={ii} className="leading-relaxed">
              {inline(it)}
            </li>
          ))}
        </ul>
      );
      continue;
    }

    // Listă ordonată (1. / 1))
    if (/^\d+[.)]\s/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+[.)]\s/.test(lines[i])) {
        items.push(lines[i].replace(/^\d+[.)]\s+/, ''));
        i++;
      }
      out.push(
        <ol key={key++} className="my-2 list-decimal space-y-1 pl-6">
          {items.map((it, ii) => (
            <li key={ii} className="leading-relaxed">
              {inline(it)}
            </li>
          ))}
        </ol>
      );
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
    out.push(
      <p key={key++} className="my-2 leading-relaxed">
        {inline(para.join(' '))}
      </p>
    );
  }

  return out;
}

// **bold**, *italic*, _italic_ — fără imbricare (suficient pentru editor).
const INLINE_RE = /\*\*([^*]+)\*\*|\*([^*]+)\*|_([^_]+)_/;

function inline(text) {
  const nodes = [];
  let rest = text;
  let k = 0;
  while (rest) {
    const m = rest.match(INLINE_RE);
    if (!m) {
      nodes.push(rest);
      break;
    }
    if (m.index > 0) nodes.push(rest.slice(0, m.index));
    if (m[1] != null) nodes.push(<strong key={k++}>{m[1]}</strong>);
    else nodes.push(<em key={k++}>{m[2] ?? m[3]}</em>);
    rest = rest.slice(m.index + m[0].length);
  }
  return nodes;
}

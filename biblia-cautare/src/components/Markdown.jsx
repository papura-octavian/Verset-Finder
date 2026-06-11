// Mini-renderer de markdown pentru predici — fără dependențe, fără HTML injectat
// (construiește direct elemente React, deci nu există risc de injecție).
// Gramatica (parsarea) stă în lib/mdBlocks.js, comună cu exportul .docx/.pdf —
// aici doar maparea AST → elemente React.
// Titlurile au mărimi relative (em), ca totul să scaleze cu font-size-ul
// containerului (previzualizare normală vs. modul prezentare).

import { parseBlocks } from '../lib/mdBlocks.js';

export default function Markdown({ text, className = '' }) {
  return <div className={className}>{renderBlocks(text || '')}</div>;
}

const H_CLS = {
  1: 'mt-6 mb-3 text-[1.6em] font-bold leading-tight first:mt-0',
  2: 'mt-5 mb-2 text-[1.35em] font-bold leading-tight first:mt-0',
  3: 'mt-4 mb-2 text-[1.15em] font-semibold leading-tight first:mt-0',
};

function renderBlocks(text) {
  return parseBlocks(text).map((b, key) => {
    if (b.type === 'h') {
      const Tag = `h${b.level}`;
      return (
        <Tag key={key} className={H_CLS[b.level]}>
          {runs(b.inlines)}
        </Tag>
      );
    }

    if (b.type === 'quote') {
      return (
        <blockquote
          key={key}
          className="my-3 space-y-1 rounded-r-md border-l-4 border-amber-300 bg-amber-50 px-3 py-2 dark:border-amber-500/60 dark:bg-amber-400/10"
        >
          {b.paras.map((q, qi) => (
            <p key={qi} className="leading-relaxed">
              {runs(q)}
            </p>
          ))}
        </blockquote>
      );
    }

    if (b.type === 'ul' || b.type === 'ol') {
      const Tag = b.type;
      return (
        <Tag key={key} className={'my-2 space-y-1 pl-6 ' + (b.type === 'ul' ? 'list-disc' : 'list-decimal')}>
          {b.items.map((it, ii) => (
            <li key={ii} className="leading-relaxed">
              {runs(it)}
            </li>
          ))}
        </Tag>
      );
    }

    return (
      <p key={key} className="my-2 leading-relaxed">
        {runs(b.inlines)}
      </p>
    );
  });
}

function runs(inlines) {
  return inlines.map((r, k) =>
    r.bold ? <strong key={k}>{r.text}</strong> : r.italic ? <em key={k}>{r.text}</em> : r.text
  );
}

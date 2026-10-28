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

    if (b.type === 'list') {
      // Marcajul e cel scris de utilizator (numărul tastat), ca sub-punctele
      // indentate să arate exact ca în editor.
      return (
        <ul key={key} className="my-2 space-y-1">
          {b.items.map((it, ii) => (
            <li key={ii} className="flex gap-2 leading-relaxed" style={{ paddingLeft: `${0.4 + it.level * 1.4}em` }}>
              <span className="w-[1.4em] shrink-0 text-right text-slate-400 tabular-nums dark:text-slate-500">
                {it.ordered ? `${it.num}.` : it.level % 2 ? '◦' : '•'}
              </span>
              <span className="min-w-0">{runs(it.inlines)}</span>
            </li>
          ))}
        </ul>
      );
    }

    if (b.type === 'hr') {
      return <hr key={key} className="my-6 border-slate-200 dark:border-slate-700" />;
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
    r.br ? <br key={k} /> : r.bold ? <strong key={k}>{r.text}</strong> : r.italic ? <em key={k}>{r.text}</em> : r.text
  );
}

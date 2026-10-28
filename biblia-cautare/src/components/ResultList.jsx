import { memo, useEffect, useState } from 'react';
import VerseCard from './VerseCard.jsx';

// Listă fără virtualizare: randăm o pagină de rezultate și adăugăm următoarea la
// cerere, ca prima afișare să fie instant chiar și pentru cuvinte foarte frecvente
// („a" are peste 30.000 de versete) fără să ascundem restul rezultatelor.
const PAGE = 100;

function ResultList({ results, query, attribution, translation = null, refine = '', total = null, onOpen, selectedIndex = -1, emptyHint = null }) {
  const [limit, setLimit] = useState(PAGE);
  // Set nou de rezultate → începe iar de la prima pagină.
  useEffect(() => setLimit(PAGE), [results]);
  // Navigarea cu ↑↓ dincolo de pagina afișată o extinde.
  useEffect(() => {
    if (selectedIndex >= limit) setLimit((l) => l + PAGE);
  }, [selectedIndex, limit]);

  if (!results) return null; // starea „idle" e gestionată de App (Versetul zilei)

  if (results.length === 0) {
    return (
      <p className="py-12 text-center text-slate-500 dark:text-slate-400">
        {refine.trim()
          ? `Niciun rezultat pentru „${refine}” în rezultatele curente.`
          : emptyHint
            ? emptyHint
            : `Niciun rezultat pentru „${query}”.`}
      </p>
    );
  }

  const shown = results.slice(0, limit);
  const rest = results.length - shown.length;

  return (
    <div>
      <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
        {results.length.toLocaleString('ro-RO')}{' '}
        {results.length === 1 ? 'rezultat' : 'rezultate'}
        {refine.trim() && total != null ? ` · filtrate din ${total.toLocaleString('ro-RO')}` : ''}
      </p>
      <ul className="space-y-3">
        {shown.map((r, i) => (
          <VerseCard
            key={`${r.abbrev}-${r.chapter}-${r.verse}`}
            result={r}
            attribution={attribution}
            translation={translation}
            onOpen={onOpen}
            index={i}
            selected={i === selectedIndex}
          />
        ))}
      </ul>
      {rest > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setLimit((l) => l + PAGE)}
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Arată încă {Math.min(PAGE, rest).toLocaleString('ro-RO')}
          </button>
          <span className="text-xs text-slate-400 dark:text-slate-500">
            {shown.length.toLocaleString('ro-RO')} din {results.length.toLocaleString('ro-RO')} afișate
          </span>
        </div>
      )}
    </div>
  );
}

// memo: schimbările de stare din App care nu privesc rezultatele (meniu, overlay,
// dark mode) sar peste lista întreagă — vezi nota din VerseCard.
export default memo(ResultList);

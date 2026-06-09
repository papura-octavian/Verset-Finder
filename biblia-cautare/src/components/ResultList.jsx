import VerseCard from './VerseCard.jsx';

// Listă fără virtualizare: limităm randarea la primele MAX_RENDER rezultate ca să
// rămână instant chiar și pentru cuvinte foarte frecvente. (Extensie viitoare:
// react-window — vezi planul §7.)
const MAX_RENDER = 500;

export default function ResultList({ results, query, attribution, refine = '', total = null, onOpen }) {
  if (!results) return null; // starea „idle" e gestionată de App (Versetul zilei)

  if (results.length === 0) {
    return (
      <p className="py-12 text-center text-slate-500 dark:text-slate-400">
        {refine.trim()
          ? `Niciun rezultat pentru „${refine}” în rezultatele curente.`
          : `Niciun rezultat pentru „${query}”.`}
      </p>
    );
  }

  const shown = results.slice(0, MAX_RENDER);

  return (
    <div>
      <p className="mb-3 text-sm text-slate-500 dark:text-slate-400">
        {results.length.toLocaleString('ro-RO')}{' '}
        {results.length === 1 ? 'rezultat' : 'rezultate'}
        {refine.trim() && total != null ? ` · filtrate din ${total.toLocaleString('ro-RO')}` : ''}
        {results.length > MAX_RENDER && ` · afișez primele ${MAX_RENDER}`}
      </p>
      <ul className="space-y-3">
        {shown.map((r) => (
          <VerseCard key={`${r.abbrev}-${r.chapter}-${r.verse}`} result={r} attribution={attribution} onOpen={onOpen} />
        ))}
      </ul>
    </div>
  );
}

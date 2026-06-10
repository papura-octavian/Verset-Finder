import { crossRefLabel } from '../lib/crossrefs.js';
import { getChapterVerses } from '../lib/reader.js';

/**
 * Lista de trimiteri a unui verset: referință + textul din traducerea activă;
 * click pe un rând deschide pasajul (onGoTo primește { abbrev, chapter, verse }).
 * Folosită și în bara de acțiuni din cititor, și pe cardurile din căutare.
 */
export default function CrossRefsList({ translation, refs, onGoTo }) {
  if (!refs.length) return null;
  return (
    <div className="space-y-0.5">
      {refs.map((r, i) => {
        const text = getChapterVerses(translation, r.abbrev, r.chapter)?.[r.verse - 1];
        return (
          <button
            key={i}
            type="button"
            onClick={() => onGoTo?.({ abbrev: r.abbrev, chapter: r.chapter, verse: r.verse })}
            title="Deschide pasajul"
            className="block w-full rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
              {crossRefLabel(translation, r)}
            </span>
            <span className="block line-clamp-2 text-sm leading-snug text-slate-500 dark:text-slate-400">
              {text ?? 'Indisponibil în această traducere.'}
            </span>
          </button>
        );
      })}
      <p className="px-2 pt-1 text-[10px] text-slate-400 dark:text-slate-500">
        Trimiteri: openbible.info (CC-BY)
      </p>
    </div>
  );
}

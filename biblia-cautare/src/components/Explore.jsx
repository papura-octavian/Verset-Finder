import { useState } from 'react';
import { parseVerseKey } from '../lib/annotations.js';
import { getChapterVerses, bookName } from '../lib/reader.js';

// Piese comune paginilor de explorare (Personaje, Locuri, Cronologie).

export const EXPLORE_PAGES = [
  { id: 'people', label: 'Personaje' },
  { id: 'places', label: 'Locuri' },
  { id: 'timeline', label: 'Cronologie' },
];

export const CARD = 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900';
export const SECTION_TITLE = 'text-sm font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500';

/** Comutatorul dintre cele trei pagini de explorare. */
export function ExploreTabs({ view, onNavigate }) {
  return (
    <div className="mb-4 inline-flex rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900" role="tablist">
      {EXPLORE_PAGES.map((p) => (
        <button
          key={p.id}
          type="button"
          role="tab"
          aria-selected={view === p.id}
          onClick={() => onNavigate(p.id)}
          className={
            'rounded-lg px-3 py-1.5 text-sm font-medium transition ' +
            (view === p.id
              ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
              : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')
          }
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

/** Versetele (chei „gn.1.27") cu textul din traducerea activă, câte 20, cu „Arată încă". */
export function VerseMentions({ keys, translation, onOpenVerse, title, action = null }) {
  const [shown, setShown] = useState(20);
  if (!keys.length) return null;
  return (
    <section className={CARD}>
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className={SECTION_TITLE}>{title}</h3>
        {action}
      </div>
      <ul className="space-y-2">
        {keys.slice(0, shown).map((k) => {
          const { abbrev, chapter, verse } = parseVerseKey(k);
          return (
            <li key={k}>
              <button
                type="button"
                onClick={() => onOpenVerse({ abbrev, chapter, verse })}
                className="w-full rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-50 dark:hover:bg-slate-800/60"
              >
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {bookName(translation, abbrev)} {chapter}:{verse}
                </span>
                <span className="mt-0.5 block text-sm leading-relaxed text-slate-600 dark:text-slate-300">
                  {getChapterVerses(translation, abbrev, chapter)?.[verse - 1] ?? ''}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {keys.length > shown && (
        <button
          type="button"
          onClick={() => setShown((n) => n + 50)}
          className="mt-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm text-slate-700 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          Arată încă {Math.min(50, keys.length - shown)}
        </button>
      )}
    </section>
  );
}

/** Nota din dicționarul Easton (engleză), pliată. */
export function EastonNote({ text }) {
  if (!text) return null;
  return (
    <details className={CARD}>
      <summary className={'cursor-pointer ' + SECTION_TITLE}>Dicționar biblic (Easton, în engleză)</summary>
      <div className="mt-3 space-y-2 text-sm leading-relaxed text-slate-700 dark:text-slate-300" lang="en">
        {text.split(/\n+/).map((para, i) => (
          <p key={i}>{para}</p>
        ))}
      </div>
    </details>
  );
}

/** Pastilă-link (persoană, loc, eveniment). */
export function LinkChip({ onClick, title, tone = 'slate', children }) {
  const tones = {
    slate: 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800',
    sky: 'border-sky-200 bg-sky-50 text-sky-800 hover:bg-sky-100 dark:border-sky-900/60 dark:bg-sky-950/40 dark:text-sky-200 dark:hover:bg-sky-900/40',
    pink: 'border-pink-200 bg-pink-50 text-pink-800 hover:bg-pink-100 dark:border-pink-900/60 dark:bg-pink-950/40 dark:text-pink-200 dark:hover:bg-pink-900/40',
    amber: 'border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200 dark:hover:bg-amber-900/40',
  };
  return (
    <button type="button" onClick={onClick} title={title} className={'rounded-full border px-2.5 py-1 text-xs font-medium transition ' + tones[tone]}>
      {children}
    </button>
  );
}

export function Pill({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        'rounded-full border px-3 py-1 text-sm transition ' +
        (active
          ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
          : 'border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800')
      }
    >
      {children}
    </button>
  );
}

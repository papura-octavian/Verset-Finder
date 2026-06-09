import { useEffect, useRef } from 'react';
import { bookList } from '../data/books.js';
import {
  getChapterVerses,
  chapterCount,
  bookName,
  prevChapter,
  nextChapter,
} from '../lib/reader.js';

/**
 * Cititorul de capitol (overlay). Controlat de App: primește `target`
 * { abbrev, chapter, verse|null } și raportează schimbările prin `onNavigate`,
 * ca App să poată sincroniza URL-ul (hash).
 */
export default function Reader({ translation, target, onNavigate, onClose }) {
  const { abbrev, chapter, verse } = target;
  const verses = getChapterVerses(translation, abbrev, chapter);
  const total = chapterCount(translation, abbrev);

  const verseRef = useRef(null);
  const bodyRef = useRef(null);

  // Închide cu Escape (prinde înaintea scurtăturilor globale din App).
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  // Derulează la versetul țintă (sau în vârf dacă nu e niciunul) la schimbarea poziției.
  useEffect(() => {
    if (verse && verseRef.current) {
      verseRef.current.scrollIntoView({ block: 'center', behavior: 'auto' });
    } else if (bodyRef.current) {
      bodyRef.current.scrollTop = 0;
    }
  }, [abbrev, chapter, verse]);

  const prev = prevChapter(translation, abbrev, chapter);
  const next = nextChapter(translation, abbrev, chapter);
  const books = bookList(translation.books);

  return (
    <div
      className="fixed inset-0 z-50 flex items-stretch justify-center bg-slate-900/50 backdrop-blur-sm sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`Cititor: ${bookName(translation, abbrev)} ${chapter}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose(); // click pe fundal = închide
      }}
    >
      <div className="flex w-full max-w-2xl flex-col bg-slate-50 shadow-2xl sm:max-h-[90vh] sm:rounded-2xl dark:bg-slate-900">
        {/* Antet */}
        <div className="flex flex-col gap-3 border-b border-slate-200 p-3 sm:p-4 dark:border-slate-800">
          <div className="flex items-center justify-between gap-2">
            <h2 className="truncate text-lg font-bold text-slate-900 dark:text-slate-100">
              {bookName(translation, abbrev)} {chapter}
            </h2>
            <button
              type="button"
              onClick={onClose}
              title="Închide (Esc)"
              aria-label="Închide cititorul"
              className="shrink-0 rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => prev && onNavigate({ abbrev: prev.abbrev, chapter: prev.chapter, verse: null })}
              disabled={!prev}
              title="Capitolul anterior"
              aria-label="Capitolul anterior"
              className="rounded-lg border border-slate-300 bg-white p-1.5 text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <ChevronLeft />
            </button>

            <select
              value={abbrev}
              onChange={(e) => onNavigate({ abbrev: e.target.value, chapter: 1, verse: null })}
              aria-label="Alege cartea"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:focus:border-slate-300"
            >
              <optgroup label="Vechiul Testament">
                {books.filter((b) => b.testament === 'VT').map((b) => (
                  <option key={b.abbrev} value={b.abbrev}>{b.name}</option>
                ))}
              </optgroup>
              <optgroup label="Noul Testament">
                {books.filter((b) => b.testament === 'NT').map((b) => (
                  <option key={b.abbrev} value={b.abbrev}>{b.name}</option>
                ))}
              </optgroup>
            </select>

            <select
              value={chapter}
              onChange={(e) => onNavigate({ abbrev, chapter: Number(e.target.value), verse: null })}
              aria-label="Alege capitolul"
              className="rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm text-slate-700 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:focus:border-slate-300"
            >
              {Array.from({ length: total }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>Cap. {n}</option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => next && onNavigate({ abbrev: next.abbrev, chapter: next.chapter, verse: null })}
              disabled={!next}
              title="Capitolul următor"
              aria-label="Capitolul următor"
              className="rounded-lg border border-slate-300 bg-white p-1.5 text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <ChevronRight />
            </button>
          </div>
        </div>

        {/* Corp: versetele capitolului */}
        <div ref={bodyRef} className="overflow-y-auto px-4 py-4 sm:px-6">
          {!verses ? (
            <p className="py-12 text-center text-slate-500 dark:text-slate-400">
              Capitol indisponibil.
            </p>
          ) : (
            <div className="space-y-1.5 leading-relaxed text-slate-700 dark:text-slate-300">
              {verses.map((text, i) => {
                const n = i + 1;
                const isTarget = verse === n;
                return (
                  <p
                    key={n}
                    ref={isTarget ? verseRef : null}
                    id={`v${n}`}
                    className={
                      'scroll-mt-4 rounded-md px-1.5 py-0.5 transition-colors ' +
                      (isTarget
                        ? 'bg-yellow-200/70 ring-1 ring-yellow-300 dark:bg-yellow-400/20 dark:ring-yellow-400/40'
                        : '')
                    }
                  >
                    <sup className="mr-1 select-none align-baseline text-xs font-semibold text-slate-400 dark:text-slate-500">
                      {n}
                    </sup>
                    {text}
                  </p>
                );
              })}
            </div>
          )}
        </div>

        {/* Subsol: atribuire */}
        <div className="border-t border-slate-200 px-4 py-2 text-center text-xs text-slate-400 sm:px-6 dark:border-slate-800 dark:text-slate-500">
          {translation.label}
        </div>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

function ChevronLeft() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function ChevronRight() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

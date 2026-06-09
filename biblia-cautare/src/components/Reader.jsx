import { Fragment, useEffect, useRef, useState } from 'react';
import { bookList } from '../data/books.js';
import { TRANSLATION_LIST } from '../lib/translations.js';
import { copyText } from '../lib/clipboard.js';
import { loadJSON, saveJSON } from '../lib/storage.js';
import {
  getChapterVerses,
  chapterCount,
  bookName,
  prevChapter,
  nextChapter,
} from '../lib/reader.js';

// Preferințe de afișare ale cititorului (persistate).
const READER_PREFS_KEY = 'biblia:reader';
const SIZES = ['text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl'];
const DEFAULT_SIZE = 2; // text-lg, confortabil pentru citit

/**
 * Cititorul de capitol (overlay). Controlat de App: primește `target`
 * { abbrev, chapter, verse|null } și raportează schimbările prin `onNavigate`,
 * ca App să poată sincroniza URL-ul (hash).
 */
export default function Reader({ translation, target, onNavigate, onClose }) {
  const { abbrev, chapter, verse } = target;
  const verses = getChapterVerses(translation, abbrev, chapter);
  const total = chapterCount(translation, abbrev);
  // Cealaltă traducere pentru comparație (abrevierile sunt comune între traduceri).
  const otherTranslation = TRANSLATION_LIST.find((t) => t.id !== translation.id) || null;

  const verseRef = useRef(null);
  const bodyRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef(null);

  // Preferințe de afișare (mărime font + serif), persistate între sesiuni.
  const [prefs, setPrefs] = useState(() => {
    const p = loadJSON(READER_PREFS_KEY, null);
    const size = p && Number.isInteger(p.size) ? Math.min(SIZES.length - 1, Math.max(0, p.size)) : DEFAULT_SIZE;
    return { size, serif: !!(p && p.serif), compare: !!(p && p.compare) };
  });
  useEffect(() => {
    saveJSON(READER_PREFS_KEY, prefs);
  }, [prefs]);

  const decFont = () => setPrefs((p) => ({ ...p, size: Math.max(0, p.size - 1) }));
  const incFont = () => setPrefs((p) => ({ ...p, size: Math.min(SIZES.length - 1, p.size + 1) }));
  const toggleSerif = () => setPrefs((p) => ({ ...p, serif: !p.serif }));
  const toggleCompare = () => setPrefs((p) => ({ ...p, compare: !p.compare }));

  // Comparația e activă doar dacă există o a doua traducere ȘI capitolul există acolo.
  const otherVerses = prefs.compare && otherTranslation
    ? getChapterVerses(otherTranslation, abbrev, chapter)
    : null;
  const compareOn = !!otherVerses;

  // Stil comun pentru o celulă de verset (highlight pe versetul țintă).
  const cellCls = (isTarget) =>
    'scroll-mt-4 rounded-md px-1.5 py-0.5 transition-colors ' +
    (isTarget
      ? 'bg-yellow-200/70 ring-1 ring-yellow-300 dark:bg-yellow-400/20 dark:ring-yellow-400/40'
      : '');
  const textCls =
    'leading-relaxed text-slate-700 dark:text-slate-300 ' +
    SIZES[prefs.size] +
    (prefs.serif ? ' font-serif' : '');

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  // Copiază în clipboard link-ul partajabil către poziția curentă (include hash-ul).
  async function shareLink() {
    const ok = await copyText(window.location.href);
    setCopied(ok);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1800);
  }

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
            <div className="flex shrink-0 items-center gap-1">
              {copied && (
                <span className="mr-1 text-xs text-emerald-600 dark:text-emerald-400">Link copiat!</span>
              )}
              <button
                type="button"
                onClick={shareLink}
                title="Copiază link-ul către acest pasaj"
                aria-label="Copiază link-ul către acest pasaj"
                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                <LinkIcon />
              </button>
              <button
                type="button"
                onClick={onClose}
                title="Închide (Esc)"
                aria-label="Închide cititorul"
                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                <CloseIcon />
              </button>
            </div>
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
          ) : compareOn ? (
            <div className={textCls}>
              {/* Antet de coloane (traducerile comparate) */}
              <div className="mb-2 grid grid-cols-2 gap-x-3 sm:gap-x-6">
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  {translation.attribution}
                </div>
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  {otherTranslation.attribution}
                </div>
              </div>
              {/* Versete aliniate: stânga = traducerea curentă, dreapta = cealaltă */}
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 sm:gap-x-6">
                {Array.from({ length: Math.max(verses.length, otherVerses.length) }, (_, i) => {
                  const n = i + 1;
                  const isTarget = verse === n;
                  return (
                    <Fragment key={n}>
                      <p ref={isTarget ? verseRef : null} id={`v${n}`} className={cellCls(isTarget)}>
                        <Vsup n={n} />
                        {verses[i] ?? ''}
                      </p>
                      <p className={cellCls(isTarget)}>
                        <Vsup n={n} />
                        {otherVerses[i] ?? ''}
                      </p>
                    </Fragment>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className={'space-y-1.5 ' + textCls}>
              {verses.map((text, i) => {
                const n = i + 1;
                const isTarget = verse === n;
                return (
                  <p key={n} ref={isTarget ? verseRef : null} id={`v${n}`} className={cellCls(isTarget)}>
                    <Vsup n={n} />
                    {text}
                  </p>
                );
              })}
            </div>
          )}
        </div>

        {/* Subsol: setări de afișare + atribuire */}
        <div className="flex items-center justify-between gap-2 border-t border-slate-200 px-3 py-2 sm:px-4 dark:border-slate-800">
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={decFont}
              disabled={prefs.size === 0}
              title="Micșorează textul"
              aria-label="Micșorează textul"
              className="rounded-md border border-slate-300 px-2 py-1 text-xs leading-none text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              A−
            </button>
            <button
              type="button"
              onClick={incFont}
              disabled={prefs.size === SIZES.length - 1}
              title="Mărește textul"
              aria-label="Mărește textul"
              className="rounded-md border border-slate-300 px-2 py-1 text-sm leading-none text-slate-600 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              A+
            </button>
            <button
              type="button"
              onClick={toggleSerif}
              aria-pressed={prefs.serif}
              title="Comută font cu serife"
              className={
                'ml-1 rounded-md border px-2 py-1 text-sm leading-none transition ' +
                (prefs.serif
                  ? 'border-slate-900 bg-slate-900 font-serif text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                  : 'border-slate-300 font-serif text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800')
              }
            >
              Serif
            </button>
            {otherTranslation && (
              <button
                type="button"
                onClick={toggleCompare}
                aria-pressed={prefs.compare}
                title={`Compară cu ${otherTranslation.attribution} (lângă lângă)`}
                aria-label={`Compară cu ${otherTranslation.attribution}`}
                className={
                  'ml-1 inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs leading-none transition ' +
                  (prefs.compare
                    ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                    : 'border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800')
                }
              >
                <ColumnsIcon />
                {otherTranslation.attribution}
              </button>
            )}
          </div>
          {!compareOn && (
            <span className="truncate text-xs text-slate-400 dark:text-slate-500">{translation.label}</span>
          )}
        </div>
      </div>
    </div>
  );
}

function Vsup({ n }) {
  return (
    <sup className="mr-1 select-none align-baseline text-xs font-semibold text-slate-400 dark:text-slate-500">
      {n}
    </sup>
  );
}

function ColumnsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M12 3v18" />
    </svg>
  );
}

function LinkIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
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

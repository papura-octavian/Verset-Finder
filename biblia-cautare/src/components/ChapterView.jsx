import { Fragment, useEffect, useRef, useState } from 'react';
import VerseActions from './VerseActions.jsx';
import { bookList } from '../data/books.js';
import { TRANSLATION_LIST } from '../lib/translations.js';
import { copyText } from '../lib/clipboard.js';
import { loadJSON, saveJSON } from '../lib/storage.js';
import { useAnnotations, verseKey, highlightBg } from '../lib/annotations.js';
import {
  getChapterVerses,
  chapterCount,
  bookName,
  prevChapter,
  nextChapter,
} from '../lib/reader.js';
import { speechSupported, useVoices, pickVoice, speakParts, pauseSpeech, resumeSpeech } from '../lib/speech.js';

const RATES = [0.8, 1, 1.2, 1.5];

// Preferințe de afișare ale cititorului (persistate).
const READER_PREFS_KEY = 'biblia:reader';
const SIZES = ['text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl'];
const DEFAULT_SIZE = 2; // text-lg, confortabil pentru citit

/**
 * Randarea unui capitol: antet (◀ carte capitol ▶ + partajare + închidere opțională),
 * corpul cu versete (eviden­țiere + comparație de traduceri), subsol cu setări de afișare.
 * Folosit ÎN AMBELE moduri:
 *  - overlay (modal): învelit de `Reader.jsx` (`pageMode=false`, primește `onClose`).
 *  - pagină (Citește): `ReadView.jsx` îl randează cu `pageMode` (fără close, antet/subsol
 *    lipicioase, derulare pe fereastră).
 * Controlat: primește `target` { abbrev, chapter, verse|null } și raportează prin
 * `onNavigate`, ca App să sincronizeze URL-ul.
 */
export default function ChapterView({ translation, target, onNavigate, onOpenPerson = null, onClose = null, pageMode = false }) {
  const { abbrev, chapter, verse } = target;
  const verses = getChapterVerses(translation, abbrev, chapter);
  const total = chapterCount(translation, abbrev);
  // Cealaltă traducere pentru comparație (abrevierile sunt comune între traduceri).
  const otherTranslation = TRANSLATION_LIST.find((t) => t.id !== translation.id) || null;

  const verseRef = useRef(null);
  const bodyRef = useRef(null);
  const [copied, setCopied] = useState(false);
  const copyTimer = useRef(null);

  // Adnotările personale (semne de carte, evidențieri, note) + versetul selectat
  // (atins) sub care se deschide bara de acțiuni. Selecția se pierde la navigare.
  const ann = useAnnotations();
  const [selected, setSelected] = useState(null);
  useEffect(() => {
    setSelected(null);
  }, [abbrev, chapter, verse]);

  // Marcajul versetului țintă e doar de orientare: pâlpâie la sosire și se stinge,
  // ca să nu fie confundat cu o evidențiere personală (galbenă, persistentă).
  const [targetFlash, setTargetFlash] = useState(true);
  useEffect(() => {
    if (verse == null) return undefined;
    setTargetFlash(true);
    const t = setTimeout(() => setTargetFlash(false), 2500);
    return () => clearTimeout(t);
  }, [abbrev, chapter, verse]);

  // Preferințe de afișare (mărime font + serif + comparație), persistate între sesiuni.
  const [prefs, setPrefs] = useState(() => {
    const p = loadJSON(READER_PREFS_KEY, null);
    const size = p && Number.isInteger(p.size) ? Math.min(SIZES.length - 1, Math.max(0, p.size)) : DEFAULT_SIZE;
    return {
      size,
      serif: !!(p && p.serif),
      compare: !!(p && p.compare),
      rate: p && RATES.includes(p.rate) ? p.rate : 1,
      autoNext: p ? p.autoNext !== false : true,
    };
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

  // Stil comun pentru o celulă de verset: evidențierea personală (culoarea aleasă)
  // are prioritate la fundal; versetul țintă e marcat doar cât durează flash-ul;
  // versetul selectat (cu bara de acțiuni deschisă) primește un contur discret.
  const cellCls = (n) => {
    const isTarget = verse === n && targetFlash;
    const isSpoken = listen?.current === n;
    const hl = highlightBg(ann.highlights[verseKey(abbrev, chapter, n)]);
    return (
      (pageMode ? 'scroll-mt-28 ' : 'scroll-mt-4 ') +
      'cursor-pointer rounded-md px-1.5 py-0.5 transition-colors ' +
      (hl ? hl + ' ' : isTarget ? 'bg-yellow-200/70 dark:bg-yellow-400/20 ' : '') +
      (isTarget ? 'ring-1 ring-yellow-300 dark:ring-yellow-400/40 ' : '') +
      (selected === n ? 'outline-2 outline-slate-400/80 dark:outline-slate-500/80 ' : '') +
      (isSpoken ? 'ring-2 ring-sky-400/70 dark:ring-sky-400/50' : '')
    );
  };

  // --- Ascultă (citire cu voce tare) ---
  // listen: null (oprit) sau { current: nr. versetului citit, paused }.
  const voices = useVoices();
  const voice = pickVoice(voices, translation.lang);
  const [listen, setListen] = useState(null);
  const stopRef = useRef(null);
  const autoplayRef = useRef(false); // capitolul următor pornește singur după navigare

  function startListening(from = 1) {
    if (!verses?.length) return;
    stopRef.current?.();
    const intro = `${bookName(translation, abbrev)}, capitolul ${chapter}. `;
    const parts = verses.slice(from - 1).map((t, i) => ({ id: from + i, text: (i === 0 && from === 1 ? intro : '') + t }));
    setListen({ current: from, paused: false });
    stopRef.current = speakParts(parts, {
      voice,
      lang: translation.lang,
      rate: prefs.rate,
      onPart: (n) => setListen((l) => (l ? { ...l, current: n } : l)),
      onEnd: () => {
        const nx = nextChapter(translation, abbrev, chapter);
        if (prefs.autoNext && nx) {
          autoplayRef.current = true;
          onNavigate({ abbrev: nx.abbrev, chapter: nx.chapter, verse: null });
        } else {
          stopRef.current = null;
          setListen(null);
        }
      },
    });
  }

  function stopListening() {
    stopRef.current?.();
    stopRef.current = null;
    setListen(null);
  }

  function togglePause() {
    if (!listen) return;
    if (listen.paused) resumeSpeech();
    else pauseSpeech();
    setListen({ ...listen, paused: !listen.paused });
  }

  // Alt capitol: continuă citirea dacă a venit de la „continuă", altfel se oprește.
  useEffect(() => {
    if (autoplayRef.current) {
      autoplayRef.current = false;
      startListening(1);
    } else if (stopRef.current) {
      stopListening();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [abbrev, chapter, translation.id]);
  useEffect(() => () => stopRef.current?.(), []);

  // Versetul care se aude rămâne pe ecran.
  useEffect(() => {
    if (listen?.current) document.getElementById(`v${listen.current}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [listen?.current]);

  // Viteza nouă se aplică imediat: reia de la versetul curent.
  useEffect(() => {
    if (listen && !listen.paused) startListening(listen.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.rate]);

  // Atingerea unui verset deschide/închide bara de acțiuni de sub el.
  const toggleSelected = (n) => setSelected((s) => (s === n ? null : n));

  // Bara de acțiuni pentru versetul n (salvează / culori / notă / copiază).
  const actionsFor = (n) => {
    const k = verseKey(abbrev, chapter, n);
    return (
      <VerseActions
        verseKey={k}
        bookmarked={!!ann.bookmarks[k]}
        collection={ann.bookmarks[k]?.collection || null}
        color={ann.highlights[k] || null}
        note={ann.notes[k] || null}
        copyPayload={`${bookName(translation, abbrev)} ${chapter}:${n} — „${verses?.[n - 1] ?? ''}” (${translation.attribution})`}
        translation={translation}
        onGoTo={onNavigate}
        onOpenPerson={onOpenPerson}
        onListen={speechSupported ? () => startListening(n) : null}
      />
    );
  };

  // Indicatorii discreți de lângă numărul versetului (semn de carte / notă).
  const marksFor = (n) => {
    const k = verseKey(abbrev, chapter, n);
    return (
      <>
        {ann.bookmarks[k] && <BookmarkMini />}
        {ann.notes[k] && <NoteMini />}
      </>
    );
  };
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

  // Derulează la versetul țintă (sau în vârf dacă nu e niciunul) la schimbarea poziției.
  useEffect(() => {
    if (verse && verseRef.current) {
      verseRef.current.scrollIntoView({ block: 'center', behavior: 'auto' });
    } else if (pageMode) {
      window.scrollTo(0, 0);
    } else if (bodyRef.current) {
      bodyRef.current.scrollTop = 0;
    }
  }, [abbrev, chapter, verse, pageMode]);

  const prev = prevChapter(translation, abbrev, chapter);
  const next = nextChapter(translation, abbrev, chapter);
  const books = bookList(translation.books);

  const panelCls = pageMode
    ? 'flex w-full flex-col'
    : 'flex w-full max-w-2xl flex-col bg-slate-50 shadow-2xl sm:max-h-[90vh] sm:rounded-2xl dark:bg-slate-900';
  const headerCls = pageMode
    ? 'sticky top-0 z-20 flex flex-col gap-3 border-b border-slate-200 bg-slate-50 p-3 sm:p-4 dark:border-slate-800 dark:bg-slate-950'
    : 'flex flex-col gap-3 border-b border-slate-200 p-3 sm:p-4 dark:border-slate-800';
  const bodyCls = pageMode
    ? 'px-4 py-4 sm:px-6'
    : 'overflow-y-auto px-4 py-4 sm:px-6';
  const footerCls = pageMode
    ? 'sticky bottom-[calc(3.5rem+env(safe-area-inset-bottom))] z-20 flex items-center justify-between gap-2 border-t sm:bottom-0 border-slate-200 bg-slate-50 px-3 py-2 sm:px-4 dark:border-slate-800 dark:bg-slate-950'
    : 'flex items-center justify-between gap-2 border-t border-slate-200 px-3 py-2 sm:px-4 dark:border-slate-800';

  return (
    <div className={panelCls}>
      {/* Antet */}
      <div className={headerCls}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="truncate text-lg font-bold text-slate-900 dark:text-slate-100">
            {bookName(translation, abbrev)} {chapter}
          </h2>
          <div className="flex shrink-0 items-center gap-1">
            {copied && (
              <span className="mr-1 text-xs text-emerald-600 dark:text-emerald-400">Link copiat!</span>
            )}
            {speechSupported && (
              <button
                type="button"
                onClick={() => (listen ? stopListening() : startListening(1))}
                aria-pressed={!!listen}
                title={listen ? 'Oprește citirea' : 'Ascultă capitolul'}
                aria-label={listen ? 'Oprește citirea' : 'Ascultă capitolul'}
                className={
                  'rounded-lg p-1.5 transition ' +
                  (listen
                    ? 'bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300'
                    : 'text-slate-500 hover:bg-slate-200 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100')
                }
              >
                <SpeakerIcon />
              </button>
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
            {onClose && (
              <button
                type="button"
                onClick={onClose}
                title="Închide (Esc)"
                aria-label="Închide cititorul"
                className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-200 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
              >
                <CloseIcon />
              </button>
            )}
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

        {listen && (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-sky-50 px-2 py-1.5 text-sm text-sky-900 dark:bg-sky-950/40 dark:text-sky-100" role="region" aria-label="Citire cu voce tare">
            <button type="button" onClick={togglePause} className="rounded-md px-2 py-0.5 font-medium transition hover:bg-sky-100 dark:hover:bg-sky-900/60">
              {listen.paused ? '▶ Continuă' : '⏸ Pauză'}
            </button>
            <button type="button" onClick={stopListening} className="rounded-md px-2 py-0.5 transition hover:bg-sky-100 dark:hover:bg-sky-900/60">
              ⏹ Stop
            </button>
            <span className="tabular-nums text-sky-700 dark:text-sky-300">v. {listen.current}</span>
            <select
              value={prefs.rate}
              onChange={(e) => setPrefs((p) => ({ ...p, rate: Number(e.target.value) }))}
              aria-label="Viteza de citire"
              className="ml-auto rounded-md border border-sky-200 bg-white px-1.5 py-0.5 text-xs dark:border-sky-800 dark:bg-slate-900"
            >
              {RATES.map((r) => (
                <option key={r} value={r}>
                  {r}×
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1 text-xs">
              <input
                type="checkbox"
                checked={prefs.autoNext}
                onChange={(e) => setPrefs((p) => ({ ...p, autoNext: e.target.checked }))}
              />
              continuă cu capitolul următor
            </label>
            {!voice && (
              <p className="w-full text-xs text-amber-700 dark:text-amber-300">
                Nu e instalată o voce {translation.lang === 'ro' ? 'românească' : 'englezească'} pe acest dispozitiv, așa că
                se citește cu vocea implicită. Pe Android și în Edge există voci românești; pe Windows le adaugi din
                Setări › Oră și limbă › Vorbire.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Corp: versetele capitolului */}
      <div ref={bodyRef} className={bodyCls}>
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
                    <p
                      ref={isTarget ? verseRef : null}
                      id={`v${n}`}
                      onClick={() => toggleSelected(n)}
                      className={cellCls(n)}
                    >
                      <Vsup n={n} />
                      {marksFor(n)}
                      {verses[i] ?? ''}
                    </p>
                    <p onClick={() => toggleSelected(n)} className={cellCls(n)}>
                      <Vsup n={n} />
                      {otherVerses[i] ?? ''}
                    </p>
                    {selected === n && <div className="col-span-2">{actionsFor(n)}</div>}
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
                <Fragment key={n}>
                  <p
                    ref={isTarget ? verseRef : null}
                    id={`v${n}`}
                    onClick={() => toggleSelected(n)}
                    className={cellCls(n)}
                  >
                    <Vsup n={n} />
                    {marksFor(n)}
                    {text}
                  </p>
                  {selected === n && actionsFor(n)}
                </Fragment>
              );
            })}
          </div>
        )}
      </div>

      {/* Subsol: setări de afișare + atribuire */}
      <div className={footerCls}>
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
  );
}

function SpeakerIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M11 5 6 9H2v6h4l5 4V5Z" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  );
}

function Vsup({ n }) {
  return (
    <sup className="mr-1 select-none align-baseline text-xs font-semibold text-slate-400 dark:text-slate-500">
      {n}
    </sup>
  );
}

function BookmarkMini() {
  return (
    <svg
      className="mr-1 inline-block align-[-1px] text-amber-500 dark:text-amber-400"
      width="11" height="11" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" strokeWidth="2" strokeLinejoin="round"
      aria-label="Verset salvat"
    >
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
    </svg>
  );
}

function NoteMini() {
  return (
    <svg
      className="mr-1 inline-block align-[-1px] text-slate-400 dark:text-slate-500"
      width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      aria-label="Verset cu notă"
    >
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
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

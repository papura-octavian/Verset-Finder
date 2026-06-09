import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SearchBar from './components/SearchBar.jsx';
import SearchHistory from './components/SearchHistory.jsx';
import ResultList from './components/ResultList.jsx';
import VerseOfDay from './components/VerseOfDay.jsx';
import { buildIndex, chapterCounts } from './lib/buildIndex.js';
import { search, norm, parseChapterSpec } from './lib/search.js';
import { verseOfDay } from './lib/verseOfDay.js';
import { loadJSON, saveJSON } from './lib/storage.js';
import { TRANSLATIONS, TRANSLATION_LIST, DEFAULT_TRANSLATION } from './lib/translations.js';
import { bookList as toBookList } from './data/books.js';
import logo from './assets/logo.png';

const HISTORY_KEY = 'biblia:history';
const DARK_KEY = 'biblia:dark';
const TRANS_KEY = 'biblia:translation';
const HISTORY_MAX = 12;

function useDebounced(value, delay) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);
  return debounced;
}

export default function App() {
  const [translation, setTranslation] = useState(() => {
    const stored = loadJSON(TRANS_KEY, null);
    return stored && TRANSLATIONS[stored] ? stored : DEFAULT_TRANSLATION;
  });
  const [index, setIndex] = useState(null);
  const [query, setQuery] = useState('');
  const [wholeWord, setWholeWord] = useState(false);
  const [exactPhrase, setExactPhrase] = useState(false);
  const [testament, setTestament] = useState('all');
  const [book, setBook] = useState('all');
  const [chapters, setChapters] = useState('');
  const [refine, setRefine] = useState('');
  const [history, setHistory] = useState(() => loadJSON(HISTORY_KEY, []));
  const [dark, setDark] = useState(() => {
    const stored = loadJSON(DARK_KEY, null);
    if (stored !== null) return stored;
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Câmpul de căutare (pentru scurtătura „/").
  const searchInputRef = useRef(null);

  // Index construit la cerere pentru traducerea activă, păstrat în cache (switch instant).
  const indexCache = useRef({});
  useEffect(() => {
    setIndex(null); // arată „Se încarcă…" cât construim
    const id = setTimeout(() => {
      if (!indexCache.current[translation]) {
        indexCache.current[translation] = buildIndex(TRANSLATIONS[translation]);
      }
      setIndex(indexCache.current[translation]);
    }, 0);
    return () => clearTimeout(id);
  }, [translation]);

  // Persistă traducerea aleasă.
  useEffect(() => {
    saveJSON(TRANS_KEY, translation);
  }, [translation]);

  // Aplică tema pe <html> și o persistă.
  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark);
    saveJSON(DARK_KEY, dark);
  }, [dark]);

  // Setează favicon-ul din logo (inline base64, deci merge și offline).
  useEffect(() => {
    let link = document.querySelector("link[rel~='icon']");
    if (!link) {
      link = document.createElement('link');
      link.rel = 'icon';
      document.head.appendChild(link);
    }
    link.href = logo;
  }, []);

  // Scurtături de tastatură: „/" focus pe căutare, „Esc" golește / iese din câmp.
  useEffect(() => {
    function onKeyDown(e) {
      const el = document.activeElement;
      const tag = el?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable;

      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      if (e.key === 'Escape') {
        const input = searchInputRef.current;
        if (input && input.value) {
          e.preventDefault();
          setQuery('');
          input.focus();
        } else if (el === input) {
          input.blur();
        }
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const debouncedQuery = useDebounced(query, 150);
  const debouncedChapters = useDebounced(chapters, 150);

  const counts = useMemo(() => chapterCounts(TRANSLATIONS[translation]), [translation]);
  const books = useMemo(() => toBookList(TRANSLATIONS[translation].books), [translation]);
  const chapterCount = book !== 'all' ? counts[book] ?? 0 : 0;
  const attribution = TRANSLATIONS[translation].attribution;

  const results = useMemo(() => {
    if (!index || !debouncedQuery.trim()) return null;
    const chapterSet = parseChapterSpec(debouncedChapters, chapterCount);
    return search(index, debouncedQuery, { wholeWord, exactPhrase, book, chapters: chapterSet, testament });
  }, [index, debouncedQuery, wholeWord, exactPhrase, book, debouncedChapters, chapterCount, testament]);

  // „Caută în rezultate": îngustează setul curent (AND pe cuvinte, fără diacritice).
  const refinedResults = useMemo(() => {
    if (!results) return results;
    const tokens = norm(refine).trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) return results;
    return results.filter((v) => tokens.every((t) => v.norm.includes(t)));
  }, [results, refine]);

  // La fiecare căutare/filtrare nouă de bază, golește „caută în rezultate".
  useEffect(() => {
    setRefine('');
  }, [results]);

  const votd = useMemo(() => verseOfDay(index), [index]);

  // La schimbarea cărții, resetează filtrul de capitole (alt domeniu valid).
  function handleBookChange(value) {
    setBook(value);
    setChapters('');
    if (value !== 'all') setTestament('all'); // o carte anume e mai specifică decât VT/NT
  }

  // Filtru rapid VT/NT: scopează la un testament și resetează cartea (scop unic, coerent).
  function handleTestamentChange(value) {
    setTestament(value);
    setBook('all');
    setChapters('');
  }

  // Salvează în istoric (la Enter / blur). Dedup case-insensitiv, mută în față, cap la HISTORY_MAX.
  const commitToHistory = useCallback(() => {
    const term = query.trim();
    if (term.length < 2) return;
    setHistory((prev) => {
      const next = [term, ...prev.filter((t) => norm(t) !== norm(term))].slice(0, HISTORY_MAX);
      saveJSON(HISTORY_KEY, next);
      return next;
    });
  }, [query]);

  function clearHistory() {
    setHistory([]);
    saveJSON(HISTORY_KEY, []);
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition-colors dark:bg-slate-950 dark:text-slate-100">
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-8">
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex items-center gap-3">
            <img
              src={logo}
              alt="Verset Finder"
              className="h-12 w-12 shrink-0 rounded-xl bg-white object-contain p-1 ring-1 ring-slate-200 sm:h-14 sm:w-14 dark:ring-slate-700"
            />
            <h1 className="text-2xl font-bold tracking-tight">Verset Finder</h1>
          </div>

          <div className="flex items-center gap-2">
            <select
              value={translation}
              onChange={(e) => setTranslation(e.target.value)}
              title="Alege traducerea"
              aria-label="Alege traducerea"
              className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none transition hover:bg-slate-100 focus:border-slate-900 sm:flex-none dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:focus:border-slate-300"
            >
              {TRANSLATION_LIST.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setDark((d) => !d)}
              title={dark ? 'Mod luminos' : 'Mod întunecat'}
              aria-label={dark ? 'Comută pe mod luminos' : 'Comută pe mod întunecat'}
              className="shrink-0 rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              {dark ? <SunIcon /> : <MoonIcon />}
            </button>
          </div>
        </header>

        <SearchBar
          query={query}
          onQueryChange={setQuery}
          onCommit={commitToHistory}
          wholeWord={wholeWord}
          onWholeWordChange={setWholeWord}
          exactPhrase={exactPhrase}
          onExactPhraseChange={setExactPhrase}
          testament={testament}
          onTestamentChange={handleTestamentChange}
          book={book}
          onBookChange={handleBookChange}
          chapters={chapters}
          onChaptersChange={setChapters}
          chapterCount={chapterCount}
          bookList={books}
          inputRef={searchInputRef}
        />

        <SearchHistory history={history} onSelect={setQuery} onClear={clearHistory} />

        <div className="mt-6" role="region" aria-label="Rezultatele căutării">
          {!index ? (
            <p className="py-12 text-center text-slate-400 dark:text-slate-500">Se încarcă Biblia…</p>
          ) : results === null ? (
            <VerseOfDay verse={votd} attribution={attribution} />
          ) : (
            <>
              {results.length > 0 && (
                <div className="mb-3">
                  <input
                    type="text"
                    value={refine}
                    onChange={(e) => setRefine(e.target.value)}
                    placeholder="Caută în rezultate…"
                    aria-label="Caută în rezultate"
                    spellCheck={false}
                    className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-300"
                  />
                </div>
              )}
              <ResultList
                results={refinedResults}
                query={debouncedQuery}
                attribution={attribution}
                refine={refine}
                total={results.length}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SearchBar from './components/SearchBar.jsx';
import SearchHistory from './components/SearchHistory.jsx';
import ResultList from './components/ResultList.jsx';
import Reader from './components/Reader.jsx';
import VerseOfDay from './components/VerseOfDay.jsx';
import { buildIndex, chapterCounts } from './lib/buildIndex.js';
import { search, norm, parseChapterSpec } from './lib/search.js';
import { verseOfDay } from './lib/verseOfDay.js';
import { parseHash, formatReader } from './lib/hash.js';
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
  // Cititorul: { abbrev, chapter, verse|null } sau null (închis).
  const [reader, setReader] = useState(null);
  // Rezultatul selectat cu tastatura (↑↓); -1 = niciunul.
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [history, setHistory] = useState(() => loadJSON(HISTORY_KEY, []));
  const [dark, setDark] = useState(() => {
    const stored = loadJSON(DARK_KEY, null);
    if (stored !== null) return stored;
    return typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches;
  });

  // Câmpul de căutare (pentru scurtătura „/").
  const searchInputRef = useRef(null);
  // Oglindă a stării cititorului pentru handler-ul global de taste (deps []).
  const readerRef = useRef(null);
  useEffect(() => {
    readerRef.current = reader;
  }, [reader]);
  // Oglindă a traducerii curente (pentru applyHash cu deps stabile).
  const translationRef = useRef(translation);
  useEffect(() => {
    translationRef.current = translation;
  }, [translation]);
  // Oglinzi pentru navigarea cu tastatura prin rezultate (handler cu deps []).
  const selectedIndexRef = useRef(-1);
  const refinedRef = useRef(null);

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
      // Cât timp cititorul e deschis, el își gestionează tastele (Esc închide).
      if (readerRef.current) return;
      const el = document.activeElement;
      const tag = el?.tagName;
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el?.isContentEditable;

      if (e.key === '/' && !typing) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      // ↑↓ prin rezultate; activ și când scrii în câmpul principal de căutare.
      const list = refinedRef.current;
      const hasResults = Array.isArray(list) && list.length > 0;
      const inSearchInput = el === searchInputRef.current;
      if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && hasResults && (!typing || inSearchInput)) {
        e.preventDefault();
        if (inSearchInput) searchInputRef.current.blur();
        setSelectedIndex((i) => {
          if (e.key === 'ArrowDown') return Math.min((i < 0 ? -1 : i) + 1, list.length - 1);
          const ni = i - 1;
          if (ni < 0) {
            searchInputRef.current?.focus();
            return -1;
          }
          return ni;
        });
        return;
      }

      // Enter deschide rezultatul selectat (când focusul nu e într-un câmp).
      if (e.key === 'Enter' && !typing && hasResults && selectedIndexRef.current >= 0) {
        const r = list[selectedIndexRef.current];
        if (r) {
          e.preventDefault();
          openReader(r);
        }
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

  // Aplică un hash de URL pe stare (deep-link, reload, back/forward, editare manuală).
  // Validează semantic (traducere/carte/capitol/verset există) — hash.js doar parsează.
  const applyHash = useCallback((raw) => {
    const parsed = parseHash(raw);
    if (!parsed) {
      if (readerRef.current) setReader(null); // back către o stare fără cititor
      return;
    }
    const wanted = TRANSLATIONS[parsed.translation] ? parsed.translation : translationRef.current;
    if (parsed.type === 'reader') {
      const book = TRANSLATIONS[wanted].data.find((b) => b.abbrev === parsed.abbrev);
      if (!book) return;
      if (parsed.chapter < 1 || parsed.chapter > book.chapters.length) return;
      let verse = parsed.verse;
      if (verse != null) {
        const vs = book.chapters[parsed.chapter - 1];
        if (!vs || verse < 1 || verse > vs.length) verse = null;
      }
      const cur = readerRef.current;
      const same = cur && cur.abbrev === parsed.abbrev && cur.chapter === parsed.chapter && cur.verse === verse;
      if (wanted !== translationRef.current) setTranslation(wanted);
      if (!same) setReader({ abbrev: parsed.abbrev, chapter: parsed.chapter, verse });
    } else {
      // type === 'search': reia căutarea din link
      if (wanted !== translationRef.current) setTranslation(wanted);
      if (readerRef.current) setReader(null);
      setQuery(parsed.query);
    }
  }, []);

  // La montare: deep-link / reload.
  useEffect(() => {
    applyHash(window.location.hash);
  }, [applyHash]);

  // Back/forward sau editare manuală a hash-ului (writerele noastre folosesc
  // push/replaceState, care NU declanșează hashchange → fără bucle).
  useEffect(() => {
    function onHashChange() {
      applyHash(window.location.hash);
    }
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [applyHash]);

  // Scrie starea cititorului în URL: push o singură intrare la deschidere (ca Back
  // să închidă cititorul), apoi replace în timpul navigării (fără a umple istoricul).
  const wasReaderOpenRef = useRef(false);
  useEffect(() => {
    if (reader) {
      const h = formatReader(translation, reader.abbrev, reader.chapter, reader.verse);
      if (window.location.hash !== h) {
        if (wasReaderOpenRef.current) window.history.replaceState(null, '', h);
        else window.history.pushState(null, '', h);
      }
      wasReaderOpenRef.current = true;
    } else {
      if (wasReaderOpenRef.current) {
        const cur = parseHash(window.location.hash);
        if (cur && cur.type === 'reader') {
          window.history.replaceState(null, '', window.location.pathname + window.location.search);
        }
      }
      wasReaderOpenRef.current = false;
    }
  }, [reader, translation]);

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

  // Oglindă pentru handler-ul de tastatură + reset selecție la schimbarea setului.
  useEffect(() => {
    refinedRef.current = refinedResults;
    setSelectedIndex(-1);
  }, [refinedResults]);
  useEffect(() => {
    selectedIndexRef.current = selectedIndex;
    if (selectedIndex >= 0) {
      const el = document.querySelector(`[data-result-index="${selectedIndex}"]`);
      el?.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  const votd = useMemo(() => verseOfDay(index), [index]);

  // La schimbarea cărții, resetează filtrul de capitole (alt domeniu valid).
  function handleBookChange(value) {
    setBook(value);
    setChapters('');
    if (value !== 'all') setTestament('all'); // o carte anume e mai specifică decât VT/NT
  }

  // Deschide cititorul la versetul dintr-un rezultat (sau orice { abbrev, chapter, verse }).
  const openReader = useCallback((r) => {
    setReader({ abbrev: r.abbrev, chapter: r.chapter, verse: r.verse ?? null });
  }, []);

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
                onOpen={openReader}
                selectedIndex={selectedIndex}
              />
            </>
          )}
        </div>
      </div>

      {reader && (
        <Reader
          translation={TRANSLATIONS[translation]}
          target={reader}
          onNavigate={setReader}
          onClose={() => setReader(null)}
        />
      )}
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

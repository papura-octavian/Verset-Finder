import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import SearchBar from './components/SearchBar.jsx';
import SearchHistory from './components/SearchHistory.jsx';
import ResultList from './components/ResultList.jsx';
import Reader from './components/Reader.jsx';
import ChapterView from './components/ChapterView.jsx';
import NavDrawer from './components/NavDrawer.jsx';
import SavedView from './components/SavedView.jsx';
import SermonsView from './components/SermonsView.jsx';
import PeopleView from './components/PeopleView.jsx';
import PlacesView from './components/PlacesView.jsx';
import TimelineView from './components/TimelineView.jsx';
import { ExploreTabs } from './components/Explore.jsx';
import VerseOfDay from './components/VerseOfDay.jsx';
import { buildIndex, chapterCounts } from './lib/buildIndex.js';
import { search, norm, parseChapterSpec } from './lib/search.js';
import { parseReference, referenceVerses, detectReference } from './lib/reference.js';
import { verseOfDay } from './lib/verseOfDay.js';
import { parseHash, formatReader, formatRead, formatPage } from './lib/hash.js';
import { loadJSON, saveJSON } from './lib/storage.js';
import { TRANSLATIONS, TRANSLATION_LIST, DEFAULT_TRANSLATION } from './lib/translations.js';
import { bookList as toBookList } from './data/books.js';
import logo from './assets/logo.png';

const HISTORY_KEY = 'biblia:history';
const DARK_KEY = 'biblia:dark';
const TRANS_KEY = 'biblia:translation';
const READ_KEY = 'biblia:read';
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
  // Pagina activă: 'search' (căutare), 'read' (citire), 'saved' (salvate)
  // sau 'sermons' (predici).
  const [view, setView] = useState('search');
  // Poziția pe pagina Citește; persistată ca să reia ultima poziție.
  const [readPos, setReadPos] = useState(() => {
    const p = loadJSON(READ_KEY, null);
    return p && p.abbrev && Number.isInteger(p.chapter)
      ? { abbrev: p.abbrev, chapter: p.chapter, verse: p.verse ?? null }
      : { abbrev: 'gn', chapter: 1, verse: null };
  });
  // Elementul deschis pe paginile de explorare: personajul / locul (slug) / evenimentul (id).
  const [sub, setSub] = useState({ people: null, places: null, timeline: null });
  const personSlug = sub.people;
  // Ultima pagină de explorare vizitată (fila „Explorează" duce înapoi la ea).
  const lastExploreRef = useRef('people');
  // Sertarul de navigație (☰).
  const [drawerOpen, setDrawerOpen] = useState(false);
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
  // Oglinzi pentru pagina activă și sertar (scurtăturile rulează doar pe Caută).
  const viewRef = useRef(view);
  const drawerOpenRef = useRef(false);
  useEffect(() => {
    viewRef.current = view;
  }, [view]);
  useEffect(() => {
    drawerOpenRef.current = drawerOpen;
  }, [drawerOpen]);

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
      // Cât timp cititorul/sertarul sunt deschise, ele își gestionează tastele (Esc).
      // Scurtăturile de căutare au sens doar pe pagina Caută.
      if (readerRef.current || drawerOpenRef.current || viewRef.current !== 'search') return;
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
      // Back către o stare fără hash: pagina Caută, fără cititor.
      if (readerRef.current) setReader(null);
      setView('search');
      return;
    }
    const wanted = TRANSLATIONS[parsed.translation] ? parsed.translation : translationRef.current;
    if (parsed.type === 'page') {
      if (wanted !== translationRef.current) setTranslation(wanted);
      if (readerRef.current) setReader(null);
      setView(parsed.page);
      if (EXPLORE.includes(parsed.page)) {
        const val = parsed.page === 'timeline' ? (parsed.sub ? Number(parsed.sub) : null) : parsed.sub;
        setSub((s) => ({ ...s, [parsed.page]: val }));
      }
      return;
    }
    if (parsed.type === 'reader' || parsed.type === 'read') {
      const book = TRANSLATIONS[wanted].data.find((b) => b.abbrev === parsed.abbrev);
      if (!book) return;
      if (parsed.chapter < 1 || parsed.chapter > book.chapters.length) return;
      let verse = parsed.verse;
      if (verse != null) {
        const vs = book.chapters[parsed.chapter - 1];
        if (!vs || verse < 1 || verse > vs.length) verse = null;
      }
      if (wanted !== translationRef.current) setTranslation(wanted);
      const pos = { abbrev: parsed.abbrev, chapter: parsed.chapter, verse };
      if (parsed.type === 'read') {
        // Pagina Citește: navighează acolo și închide overlay-ul dacă era deschis.
        setView('read');
        setReadPos(pos);
        if (readerRef.current) setReader(null);
      } else {
        // Cititorul-overlay (peste pagina Caută).
        setView('search');
        const cur = readerRef.current;
        const same = cur && cur.abbrev === pos.abbrev && cur.chapter === pos.chapter && cur.verse === verse;
        if (!same) setReader(pos);
      }
    } else {
      // type === 'search': reia căutarea din link
      if (wanted !== translationRef.current) setTranslation(wanted);
      if (readerRef.current) setReader(null);
      setView('search');
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
          // Cititorul deschis peste o pagină (Salvate, un personaj…) lasă în URL pagina de dedesubt.
          window.history.replaceState(null, '', pageHashRef.current() || window.location.pathname + window.location.search);
        }
      }
      wasReaderOpenRef.current = false;
    }
  }, [reader, translation]);

  // Persistă poziția de citire (pagina Citește reia de unde ai rămas).
  useEffect(() => {
    saveJSON(READ_KEY, readPos);
  }, [readPos]);

  // Scrie starea paginii Citește în URL (replace — fără spam în istoric).
  // Nu se atinge de hash-urile overlay-ului (acelea sunt gestionate mai sus).
  useEffect(() => {
    if (view === 'read') {
      const h = formatRead(translation, readPos.abbrev, readPos.chapter, readPos.verse);
      if (window.location.hash !== h) window.history.replaceState(null, '', h);
    } else if (view === 'saved' || view === 'sermons' || EXPLORE.includes(view)) {
      // Cât e deschis cititorul-overlay, URL-ul e al lui.
      if (readerRef.current) return;
      const h = formatPage(translation, view, sub[view] ?? null);
      if (window.location.hash !== h) window.history.replaceState(null, '', h);
    } else {
      const cur = parseHash(window.location.hash);
      if (cur && cur.type === 'read') {
        window.history.replaceState(null, '', window.location.pathname + window.location.search);
      }
    }
  }, [view, readPos, translation, sub]);

  const debouncedQuery = useDebounced(query, 150);
  const debouncedChapters = useDebounced(chapters, 150);

  const counts = useMemo(() => chapterCounts(TRANSLATIONS[translation]), [translation]);
  const books = useMemo(() => toBookList(TRANSLATIONS[translation].books), [translation]);
  const chapterCount = book !== 'all' ? counts[book] ?? 0 : 0;
  const attribution = TRANSLATIONS[translation].attribution;

  // Mod referință: query începe cu „@" → aducem un pasaj după referință, nu cuvinte.
  // Fără „@", o referință clară („ioan 3:16", „ps 23") e recunoscută automat;
  // „Caută ca text" o tratează totuși ca pe o căutare de cuvinte.
  const [textOnly, setTextOnly] = useState(false);
  useEffect(() => setTextOnly(false), [debouncedQuery]);
  const refInfo = useMemo(() => {
    const q = debouncedQuery.trim();
    if (q.startsWith('@')) return parseReference(q, TRANSLATIONS[translation]); // {abbrev,...} | {error}
    if (textOnly) return null;
    const detected = detectReference(q, TRANSLATIONS[translation]);
    return detected ? { ...detected, auto: true } : null;
  }, [debouncedQuery, translation, textOnly]);

  const results = useMemo(() => {
    if (!index || !debouncedQuery.trim()) return null;
    if (refInfo) {
      if (refInfo.error) return [];
      return referenceVerses(TRANSLATIONS[translation], refInfo);
    }
    const chapterSet = parseChapterSpec(debouncedChapters, chapterCount);
    return search(index, debouncedQuery, { wholeWord, exactPhrase, book, chapters: chapterSet, testament });
  }, [index, debouncedQuery, refInfo, translation, wholeWord, exactPhrase, book, debouncedChapters, chapterCount, testament]);

  // Mesaj de gol potrivit pentru modul referință (altfel se folosește cel implicit).
  const emptyHint = useMemo(() => {
    if (!refInfo) return null;
    if (refInfo.error === 'book') return 'Carte negăsită sau ambiguă. Ex: @ioan 3:16';
    if (refInfo.error) return 'Referință nevalidă. Ex: @ioan 3:16, @isaia 1, @isaia 1:1-10';
    return 'Capitolul sau versetul nu există în această carte.';
  }, [refInfo]);

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

  const readPosRef = useRef(readPos);
  useEffect(() => {
    readPosRef.current = readPos;
  }, [readPos]);

  // Hash-ul paginii curente (fără cititorul-overlay), ținut într-o ref pentru efectele cu deps fixe.
  const pageHashRef = useRef(() => '');
  pageHashRef.current = () =>
    view === 'read'
      ? formatRead(translation, readPos.abbrev, readPos.chapter, readPos.verse)
      : view === 'saved' || view === 'sermons' || EXPLORE.includes(view)
        ? formatPage(translation, view, sub[view] ?? null)
        : '';

  // Schimbarea paginii adaugă o intrare în istoric, ca Back să revină la pagina anterioară.
  // `item` = personajul / locul / evenimentul, pe paginile de explorare.
  // „explore" (fila de pe telefon) = ultima pagină de explorare vizitată.
  const navigate = useCallback((target, item = null) => {
    const next = target === 'explore' ? lastExploreRef.current : target;
    if (EXPLORE.includes(next)) lastExploreRef.current = next;
    const t = translationRef.current;
    const h =
      next === 'read'
        ? formatRead(t, readPosRef.current.abbrev, readPosRef.current.chapter, readPosRef.current.verse)
        : next === 'saved' || next === 'sermons' || EXPLORE.includes(next)
          ? formatPage(t, next, item)
          : window.location.pathname + window.location.search;
    const cur = window.location.hash ? window.location.hash : window.location.pathname + window.location.search;
    if (cur !== h) window.history.pushState(null, '', h);
    setReader(null);
    if (EXPLORE.includes(next)) setSub((s) => ({ ...s, [next]: item }));
    setView(next);
    // Pe hartă, alegerea unui loc nu derulează pagina (harta rămâne unde e).
    if (next !== 'places' || item == null) window.scrollTo(0, 0);
  }, []);

  const openPerson = useCallback((slug) => navigate('people', slug), [navigate]);
  const openPlace = useCallback((slug) => navigate('places', slug), [navigate]);
  const openEvent = useCallback((id) => navigate('timeline', id), [navigate]);

  // Din pagina unui personaj: „caută numele în toată Biblia".
  const searchFor = useCallback(
    (q) => {
      navigate('search');
      setQuery(q);
    },
    [navigate]
  );

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
      {/* Pagina Predici folosește toată lățimea ecranului (layout tip Obsidian);
          restul paginilor rămân pe coloana îngustă de citit/căutat. */}
      <div className={'mx-auto px-4 pb-24 pt-6 sm:py-8 ' + (view === 'sermons' ? 'max-w-none sm:px-6' : view === 'places' ? 'max-w-6xl' : 'max-w-3xl')}>
        <header className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              title="Deschide meniul"
              aria-label="Deschide meniul de navigație"
              aria-expanded={drawerOpen}
              className="shrink-0 rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              <MenuIcon />
            </button>
            <img
              src={logo}
              alt="Verset Finder"
              className="h-12 w-12 shrink-0 rounded-xl bg-white object-contain p-1 ring-1 ring-slate-200 sm:h-14 sm:w-14 dark:ring-slate-700"
            />
            <h1 className="text-2xl font-bold tracking-tight">
              {view === 'read'
                ? 'Citește'
                : view === 'saved'
                  ? 'Salvate'
                  : view === 'sermons'
                    ? 'Predici'
                    : view === 'people'
                      ? 'Personaje'
                      : view === 'places'
                        ? 'Locuri'
                        : view === 'timeline'
                          ? 'Cronologie'
                          : 'Verset Finder'}
            </h1>
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

        {/* Paginile, mereu vizibile de la tabletă în sus (pe telefon: bara de jos). */}
        <PageTabs view={view} onNavigate={navigate} className="-mt-2 mb-6 hidden w-fit sm:flex" />

        {view === 'read' ? (
          /* Pagina Citește: același renderer de capitol ca overlay-ul, în pagină. */
          <div className="mx-auto max-w-2xl">
            <ChapterView
              translation={TRANSLATIONS[translation]}
              target={readPos}
              onNavigate={setReadPos}
              onOpenPerson={openPerson}
              onOpenPlace={openPlace}
              pageMode
            />
          </div>
        ) : view === 'saved' ? (
          /* Pagina Salvate: semne de carte, evidențieri și note personale. */
          <div className="mx-auto max-w-2xl">
            <SavedView translation={TRANSLATIONS[translation]} onOpen={openReader} />
          </div>
        ) : view === 'sermons' ? (
          /* Pagina Predici: editorul de predici (folosește toată lățimea). */
          <SermonsView translation={TRANSLATIONS[translation]} />
        ) : view === 'people' ? (
          /* Pagina Personaje: wiki + genealogie pentru fiecare persoană din Biblie. */
          <div className="mx-auto max-w-2xl">
            <ExploreTabs view={view} onNavigate={navigate} />
            <PeopleView
              translation={TRANSLATIONS[translation]}
              slug={personSlug}
              onOpenPerson={openPerson}
              onOpenEvent={openEvent}
              onOpenVerse={openReader}
              onSearch={searchFor}
            />
          </div>
        ) : view === 'places' ? (
          /* Pagina Locuri: harta lumii biblice + o pagină pentru fiecare loc. */
          <div>
            <ExploreTabs view={view} onNavigate={navigate} />
            <PlacesView
              translation={TRANSLATIONS[translation]}
              slug={sub.places}
              onOpenPlace={openPlace}
              onOpenEvent={openEvent}
              onOpenVerse={openReader}
              onSearch={searchFor}
            />
          </div>
        ) : view === 'timeline' ? (
          /* Pagina Cronologie: evenimentele Bibliei pe ani și epoci. */
          <div className="mx-auto max-w-2xl">
            <ExploreTabs view={view} onNavigate={navigate} />
            <TimelineView
              translation={TRANSLATIONS[translation]}
              eventId={sub.timeline}
              onOpenPerson={openPerson}
              onOpenPlace={openPlace}
              onOpenVerse={openReader}
            />
          </div>
        ) : (
          <>
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
                  {refInfo?.auto && results.length > 0 && (
                    <p className="mb-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-slate-500 dark:text-slate-400">
                      <span>
                        Pasaj: <strong className="text-slate-800 dark:text-slate-200">{refLabel(results)}</strong>
                      </span>
                      <button
                        type="button"
                        onClick={() => setTextOnly(true)}
                        className="rounded-md px-1.5 py-0.5 text-xs underline decoration-dotted underline-offset-2 transition hover:bg-slate-200 dark:hover:bg-slate-800"
                      >
                        caută cuvintele în schimb
                      </button>
                    </p>
                  )}
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
                    translation={TRANSLATIONS[translation]}
                    refine={refine}
                    total={results.length}
                    onOpen={openReader}
                    selectedIndex={selectedIndex}
                    emptyHint={emptyHint}
                  />
                </>
              )}
            </div>
          </>
        )}
      </div>

      {/* Bara de pagini de pe telefon, la îndemâna degetului mare (ChapterView își ridică subsolul deasupra ei). */}
      <nav
        aria-label="Pagini"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-slate-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:hidden dark:border-slate-800 dark:bg-slate-950/95"
      >
        <PageTabs view={view} onNavigate={navigate} bottom />
      </nav>

      <NavDrawer
        open={drawerOpen}
        view={view}
        onNavigate={navigate}
        onClose={() => setDrawerOpen(false)}
      />

      {reader && (
        <Reader
          translation={TRANSLATIONS[translation]}
          target={reader}
          onNavigate={setReader}
          onOpenPerson={openPerson}
          onOpenPlace={openPlace}
          onClose={() => setReader(null)}
        />
      )}
    </div>
  );
}

/** Eticheta pasajului recunoscut: „Ioan 3:16" sau „Psalmii 23:1-6". */
function refLabel(results) {
  const a = results[0];
  const b = results[results.length - 1];
  return results.length === 1 ? a.ref : `${a.book} ${a.chapter}:${a.verse}-${b.verse}`;
}

// Paginile grupate sub fila „Explorează".
const EXPLORE = ['people', 'places', 'timeline'];

const PAGE_TABS = [
  { id: 'search', label: 'Caută', icon: 'M21 21l-4.3-4.3M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Z' },
  { id: 'read', label: 'Citește', icon: 'M2 4h6a4 4 0 0 1 4 4v13a3 3 0 0 0-3-3H2ZM22 4h-6a4 4 0 0 0-4 4v13a3 3 0 0 1 3-3h7Z' },
  { id: 'saved', label: 'Salvate', icon: 'm19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z' },
  { id: 'explore', label: 'Explorează', icon: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20ZM16.24 7.76l-2.12 6.36-6.36 2.12 2.12-6.36 6.36-2.12Z' },
  { id: 'sermons', label: 'Predici', icon: 'M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z' },
];

/** Comutatorul de pagini: rând de file în antet, sau bara de jos pe telefon (`bottom`). */
function PageTabs({ view, onNavigate, bottom = false, className = '' }) {
  return (
    <div className={(bottom ? 'mx-auto grid max-w-md grid-cols-5' : 'items-center gap-1 rounded-xl border border-slate-200 bg-white p-1 dark:border-slate-800 dark:bg-slate-900') + ' ' + className}>
      {PAGE_TABS.map((p) => {
        const active = view === p.id || (p.id === 'explore' && EXPLORE.includes(view));
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => onNavigate(p.id)}
            aria-current={active ? 'page' : undefined}
            className={
              bottom
                ? 'flex flex-col items-center gap-0.5 py-2 text-[11px] font-medium transition ' +
                  (active ? 'text-slate-900 dark:text-white' : 'text-slate-400 hover:text-slate-700 dark:text-slate-500 dark:hover:text-slate-200')
                : 'inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition ' +
                  (active
                    ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                    : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')
            }
          >
            <svg width={bottom ? 22 : 16} height={bottom ? 22 : 16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active && bottom ? 2.4 : 2} strokeLinecap="round" strokeLinejoin="round">
              <path d={p.icon} />
            </svg>
            {p.label}
          </button>
        );
      })}
    </div>
  );
}

function MenuIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 6h16M4 12h16M4 18h16" />
    </svg>
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

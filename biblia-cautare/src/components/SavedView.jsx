import { useEffect, useMemo, useState } from 'react';
import {
  useAnnotations,
  parseVerseKey,
  toggleBookmark,
  setBookmarkCollection,
  setHighlight,
  setNote,
  collectionNames,
  HIGHLIGHT_COLORS,
} from '../lib/annotations.js';
import { getChapterVerses, bookName } from '../lib/reader.js';

const TABS = [
  { id: 'bookmarks', label: 'Semne de carte' },
  { id: 'highlights', label: 'Evidențieri' },
  { id: 'notes', label: 'Note' },
];

const CARD = 'rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900';

/**
 * Pagina „Salvate": semnele de carte (cu colecții), evidențierile și notele,
 * organizate pe taburi. Textul versetelor vine din traducerea activă; click pe
 * referință deschide cititorul-overlay la versetul respectiv (`onOpen`).
 */
export default function SavedView({ translation, onOpen }) {
  const ann = useAnnotations();
  const [tab, setTab] = useState('bookmarks');
  // Filtrul de colecție al tabului „Semne de carte" ('all' = toate).
  const [collection, setCollection] = useState('all');
  // Rândul pentru care se creează o colecție nouă (cheia versetului) + numele tastat.
  const [newFor, setNewFor] = useState(null);
  const [newName, setNewName] = useState('');

  const collections = useMemo(() => collectionNames(ann.bookmarks), [ann.bookmarks]);

  // Dacă filtrul activ rămâne fără colecție (ultimul semn mutat/șters), revino la „Toate".
  useEffect(() => {
    if (collection !== 'all' && !collections.includes(collection)) setCollection('all');
  }, [collection, collections]);

  // Cheie de verset → rând afișabil (referință + textul din traducerea activă).
  const row = (key) => {
    const { abbrev, chapter, verse } = parseVerseKey(key);
    const vs = getChapterVerses(translation, abbrev, chapter);
    return {
      key,
      abbrev,
      chapter,
      verse,
      ref: `${bookName(translation, abbrev)} ${chapter}:${verse}`,
      text: vs?.[verse - 1] ?? '',
    };
  };
  const orderOf = (abbrev) => translation.books[abbrev]?.order ?? 999;

  // Semne de carte: cele mai recente primele, filtrate după colecție.
  const bookmarkRows = useMemo(() => {
    let entries = Object.entries(ann.bookmarks);
    if (collection !== 'all') entries = entries.filter(([, b]) => b.collection === collection);
    entries.sort((a, b) => b[1].at - a[1].at);
    return entries.map(([key, b]) => ({ ...row(key), at: b.at, collection: b.collection }));
  }, [ann.bookmarks, collection, translation]);

  // Evidențieri: în ordine canonică (carte → capitol → verset).
  const highlightRows = useMemo(() => {
    return Object.entries(ann.highlights)
      .map(([key, color]) => ({ ...row(key), color }))
      .sort((a, b) => orderOf(a.abbrev) - orderOf(b.abbrev) || a.chapter - b.chapter || a.verse - b.verse);
  }, [ann.highlights, translation]);

  // Note: cele mai recente primele.
  const noteRows = useMemo(() => {
    return Object.entries(ann.notes)
      .map(([key, n]) => ({ ...row(key), noteText: n.text, at: n.at }))
      .sort((a, b) => b.at - a.at);
  }, [ann.notes, translation]);

  const counts = {
    bookmarks: Object.keys(ann.bookmarks).length,
    highlights: Object.keys(ann.highlights).length,
    notes: Object.keys(ann.notes).length,
  };

  function handleCollectionChange(key, value) {
    if (value === '__new') {
      setNewFor(key);
      setNewName('');
    } else {
      setBookmarkCollection(key, value);
    }
  }

  function confirmNewCollection(key) {
    const name = newName.trim();
    if (name) setBookmarkCollection(key, name);
    setNewFor(null);
    setNewName('');
  }

  return (
    <div>
      {/* Taburi */}
      <div className="mb-4 flex flex-wrap gap-2" role="tablist" aria-label="Categorii de salvate">
        {TABS.map((t) => {
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={
                'rounded-lg border px-3 py-1.5 text-sm transition ' +
                (active
                  ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800')
              }
            >
              {t.label} ({counts[t.id]})
            </button>
          );
        })}
      </div>

      {/* Semne de carte */}
      {tab === 'bookmarks' && (
        <>
          {collections.length > 0 && (
            <div className="mb-3 flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtru de colecții">
              <Chip active={collection === 'all'} onClick={() => setCollection('all')}>
                Toate
              </Chip>
              {collections.map((c) => (
                <Chip key={c} active={collection === c} onClick={() => setCollection(c)}>
                  {c}
                </Chip>
              ))}
            </div>
          )}

          {bookmarkRows.length === 0 ? (
            <Empty>
              {collection === 'all'
                ? 'Niciun verset salvat încă. Atinge un verset în cititor sau folosește semnul de carte de pe un rezultat de căutare.'
                : 'Nicio salvare în această colecție.'}
            </Empty>
          ) : (
            <ul className="space-y-3">
              {bookmarkRows.map((r) => (
                <li key={r.key} className={CARD}>
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <RefButton r={r} onOpen={onOpen} />
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs text-slate-400 dark:text-slate-500">{fmtDate(r.at)}</span>
                      <IconButton label="Șterge semnul de carte" onClick={() => toggleBookmark(r.key)}>
                        <TrashIcon />
                      </IconButton>
                    </div>
                  </div>
                  <p className="line-clamp-2 leading-relaxed text-slate-700 dark:text-slate-300">{r.text}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {newFor === r.key ? (
                      <>
                        <input
                          type="text"
                          value={newName}
                          onChange={(e) => setNewName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') confirmNewCollection(r.key);
                            if (e.key === 'Escape') setNewFor(null);
                          }}
                          autoFocus
                          placeholder="Numele colecției…"
                          aria-label="Numele colecției noi"
                          className="w-44 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-300"
                        />
                        <button
                          type="button"
                          onClick={() => confirmNewCollection(r.key)}
                          className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
                        >
                          Adaugă
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewFor(null)}
                          className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
                        >
                          Renunță
                        </button>
                      </>
                    ) : (
                      <select
                        value={r.collection ?? ''}
                        onChange={(e) => handleCollectionChange(r.key, e.target.value)}
                        aria-label={`Colecția pentru ${r.ref}`}
                        className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 outline-none transition focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:focus:border-slate-300"
                      >
                        <option value="">Fără colecție</option>
                        {collections.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                        <option value="__new">+ Colecție nouă…</option>
                      </select>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {/* Evidențieri */}
      {tab === 'highlights' &&
        (highlightRows.length === 0 ? (
          <Empty>Nicio evidențiere încă. Atinge un verset în cititor și alege o culoare.</Empty>
        ) : (
          <ul className="space-y-3">
            {highlightRows.map((r) => {
              const c = HIGHLIGHT_COLORS.find((x) => x.id === r.color);
              return (
                <li key={r.key} className={CARD}>
                  <div className="mb-1 flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2">
                      <span
                        className={'h-3 w-3 shrink-0 rounded-full ' + (c?.dot ?? 'bg-slate-300')}
                        title={c?.label}
                        aria-label={`Culoare: ${c?.label ?? 'necunoscută'}`}
                      />
                      <RefButton r={r} onOpen={onOpen} />
                    </span>
                    <IconButton label="Șterge evidențierea" onClick={() => setHighlight(r.key, null)}>
                      <TrashIcon />
                    </IconButton>
                  </div>
                  <p className="line-clamp-2 leading-relaxed text-slate-700 dark:text-slate-300">{r.text}</p>
                </li>
              );
            })}
          </ul>
        ))}

      {/* Note */}
      {tab === 'notes' &&
        (noteRows.length === 0 ? (
          <Empty>Nicio notă încă. Atinge un verset în cititor și apasă „Notă".</Empty>
        ) : (
          <ul className="space-y-3">
            {noteRows.map((r) => (
              <li key={r.key} className={CARD}>
                <div className="mb-1 flex items-center justify-between gap-3">
                  <RefButton r={r} onOpen={onOpen} />
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs text-slate-400 dark:text-slate-500">{fmtDate(r.at)}</span>
                    <IconButton label="Șterge nota" onClick={() => setNote(r.key, '')}>
                      <TrashIcon />
                    </IconButton>
                  </div>
                </div>
                <p className="line-clamp-1 text-sm italic text-slate-400 dark:text-slate-500">{r.text}</p>
                <p className="mt-1 whitespace-pre-wrap leading-relaxed text-slate-700 dark:text-slate-300">{r.noteText}</p>
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
}

function fmtDate(at) {
  return new Date(at).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short', year: 'numeric' });
}

function RefButton({ r, onOpen }) {
  return (
    <button
      type="button"
      onClick={() => onOpen?.({ abbrev: r.abbrev, chapter: r.chapter, verse: r.verse })}
      title="Deschide în cititor"
      className="truncate rounded text-left text-sm font-semibold text-slate-900 underline-offset-2 transition hover:text-slate-600 hover:underline dark:text-slate-100 dark:hover:text-slate-300"
    >
      {r.ref}
    </button>
  );
}

function Chip({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        'rounded-full border px-2.5 py-1 text-xs transition ' +
        (active
          ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
          : 'border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800')
      }
    >
      {children}
    </button>
  );
}

function Empty({ children }) {
  return <p className="py-12 text-center text-slate-500 dark:text-slate-400">{children}</p>;
}

function IconButton({ label, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-red-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-red-400"
    >
      {children}
    </button>
  );
}

function TrashIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18" />
      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
      <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <path d="M10 11v6M14 11v6" />
    </svg>
  );
}

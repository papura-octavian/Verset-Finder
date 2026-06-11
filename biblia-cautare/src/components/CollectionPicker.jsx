import { useState } from 'react';
import { useAnnotations, collectionNames, setBookmarkCollection } from '../lib/annotations.js';

/**
 * Alege colecția unui semn de carte direct de unde a fost salvat (rezultatul
 * din căutare, bara de acțiuni din cititor) — fără drumul prin pagina Salvate.
 * Se randă doar pentru un verset deja salvat; „+ Colecție nouă…" deschide un
 * input inline, ca în pagina Salvate. După o alegere definitivă cheamă onDone.
 */
export default function CollectionPicker({ verseKey: k, refLabel, onDone }) {
  const ann = useAnnotations();
  const [naming, setNaming] = useState(false);
  const [name, setName] = useState('');

  const bm = ann.bookmarks[k];
  if (!bm) return null;
  const collections = collectionNames(ann.bookmarks);

  function choose(value) {
    if (value === '__new') {
      setNaming(true);
      setName('');
      return;
    }
    setBookmarkCollection(k, value);
    onDone?.();
  }

  function confirmNew() {
    const n = name.trim();
    if (n) setBookmarkCollection(k, n);
    setNaming(false);
    if (n) onDone?.();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-slate-400 dark:text-slate-500">Colecția:</span>
      {naming ? (
        <>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') confirmNew();
              if (e.key === 'Escape') {
                e.stopPropagation();
                setNaming(false);
              }
            }}
            autoFocus
            placeholder="Numele colecției…"
            aria-label="Numele colecției noi"
            className="w-44 rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-300"
          />
          <button
            type="button"
            onClick={confirmNew}
            className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
          >
            Adaugă
          </button>
          <button
            type="button"
            onClick={() => setNaming(false)}
            className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
          >
            Renunță
          </button>
        </>
      ) : (
        <select
          value={bm.collection ?? ''}
          onChange={(e) => choose(e.target.value)}
          aria-label={`Colecția pentru ${refLabel}`}
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
  );
}

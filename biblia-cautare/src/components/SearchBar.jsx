export default function SearchBar({
  query,
  onQueryChange,
  onCommit,
  wholeWord,
  onWholeWordChange,
  exactPhrase,
  onExactPhraseChange,
  testament,
  onTestamentChange,
  book,
  onBookChange,
  chapters,
  onChaptersChange,
  chapterCount,
  bookList,
  inputRef,
}) {
  const bookSelected = book && book !== 'all';
  const VT = bookList.filter((b) => b.testament === 'VT');
  const NT = bookList.filter((b) => b.testament === 'NT');

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <input
        ref={inputRef}
        type="text"
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onCommit()}
        onBlur={onCommit}
        placeholder="Caută un cuvânt sau o frază…"
        aria-label="Caută în Biblie"
        aria-keyshortcuts="/"
        autoFocus
        spellCheck={false}
        className="w-full rounded-lg border border-slate-300 bg-white px-4 py-3 text-lg text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 focus:ring-2 focus:ring-slate-900/10 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-300 dark:focus:ring-slate-100/10"
      />

      {/* Rândul 1: filtru rapid VT/NT + carte + capitole */}
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
        <div
          className="inline-flex rounded-lg border border-slate-300 p-0.5 dark:border-slate-700"
          role="group"
          aria-label="Filtru testament"
        >
          {[
            { value: 'all', label: 'Toată Biblia' },
            { value: 'VT', label: 'Vechiul T.' },
            { value: 'NT', label: 'Noul T.' },
          ].map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => onTestamentChange(o.value)}
              aria-pressed={testament === o.value}
              className={
                'rounded-md px-2.5 py-1 text-sm transition ' +
                (testament === o.value
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')
              }
            >
              {o.label}
            </button>
          ))}
        </div>

        <select
          value={book}
          onChange={(e) => onBookChange(e.target.value)}
          className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:focus:border-slate-300"
        >
          <option value="all">Toate cărțile</option>
          <optgroup label="Vechiul Testament">
            {VT.map((b) => (
              <option key={b.abbrev} value={b.abbrev}>
                {b.name}
              </option>
            ))}
          </optgroup>
          <optgroup label="Noul Testament">
            {NT.map((b) => (
              <option key={b.abbrev} value={b.abbrev}>
                {b.name}
              </option>
            ))}
          </optgroup>
        </select>

        {bookSelected && (
          <input
            type="text"
            value={chapters}
            onChange={(e) => onChaptersChange(e.target.value)}
            placeholder={`Capitole: toate (1–${chapterCount})`}
            spellCheck={false}
            title="Ex: 1-3, 5, 8-10. Gol = toată cartea."
            className="w-44 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:placeholder:text-slate-500 dark:focus:border-slate-300"
          />
        )}
      </div>

      {/* Rândul 2: opțiuni de căutare */}
      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-3">
        <Toggle label="Cuvânt întreg" checked={wholeWord} onChange={onWholeWordChange} />
        <Toggle label="Frază exactă" checked={exactPhrase} onChange={onExactPhraseChange} />
      </div>
    </div>
  );
}

function Toggle({ label, checked, onChange }) {
  return (
    <label className="flex cursor-pointer select-none items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="h-4 w-4 rounded border-slate-300 accent-slate-900 dark:accent-slate-100"
      />
      <span>{label}</span>
    </label>
  );
}

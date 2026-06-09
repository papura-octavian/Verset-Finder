export default function SearchHistory({ history, onSelect, onClear }) {
  if (!history || history.length === 0) return null;

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2">
      <span className="text-xs font-medium uppercase tracking-wide text-slate-400 dark:text-slate-500">
        Istoric
      </span>
      {history.map((term) => (
        <button
          key={term}
          type="button"
          onClick={() => onSelect(term)}
          className="rounded-full bg-slate-100 px-3 py-1 text-sm text-slate-700 transition hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
        >
          {term}
        </button>
      ))}
      <button
        type="button"
        onClick={onClear}
        className="ml-1 text-xs text-slate-400 underline-offset-2 hover:text-slate-600 hover:underline dark:text-slate-500 dark:hover:text-slate-300"
      >
        șterge
      </button>
    </div>
  );
}

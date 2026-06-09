import { useEffect, useRef, useState } from 'react';
import { copyText } from '../lib/clipboard.js';

export default function VerseOfDay({ verse, attribution }) {
  const [feedback, setFeedback] = useState('');
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  if (!verse) {
    return (
      <p className="py-12 text-center text-slate-400 dark:text-slate-500">
        Scrie un cuvânt sau o frază pentru a căuta.
      </p>
    );
  }

  async function handleCopy() {
    const ok = await copyText(`${verse.ref} — „${verse.text}” (${attribution})`);
    setFeedback(ok ? 'Copiat!' : 'Eroare');
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setFeedback(''), 1800);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
        Versetul zilei
      </p>
      <p className="text-lg leading-relaxed text-slate-800 dark:text-slate-200">
        „{verse.text}”
      </p>
      <div className="mt-4 flex items-center justify-center gap-3">
        <span className="text-sm font-semibold text-slate-500 dark:text-slate-400">{verse.ref}</span>
        <button
          type="button"
          onClick={handleCopy}
          title="Copiază versetul"
          aria-label="Copiază versetul"
          className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
        {feedback && (
          <span className="text-xs text-emerald-600 dark:text-emerald-400">{feedback}</span>
        )}
      </div>
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { copyText } from '../lib/clipboard.js';

export default function VerseCard({ result, attribution, onOpen, index = null, selected = false }) {
  const [feedback, setFeedback] = useState('');
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  function flash(msg) {
    setFeedback(msg);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setFeedback(''), 1800);
  }

  const payload = `${result.ref} — „${result.text}” (${attribution})`;

  async function handleCopy() {
    const ok = await copyText(payload);
    flash(ok ? 'Copiat!' : 'Eroare');
  }

  return (
    <li
      data-result-index={index}
      className={
        'rounded-xl border bg-white p-4 shadow-sm transition dark:bg-slate-900 ' +
        (selected
          ? 'border-slate-900 ring-2 ring-slate-900/20 dark:border-slate-100 dark:ring-slate-100/20'
          : 'border-slate-200 dark:border-slate-800')
      }
    >
      <div className="mb-1 flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onOpen?.(result)}
          title="Deschide capitolul în cititor"
          className="rounded text-left text-sm font-semibold text-slate-900 underline-offset-2 transition hover:text-slate-600 hover:underline dark:text-slate-100 dark:hover:text-slate-300"
        >
          {result.ref}
        </button>
        <div className="flex items-center gap-1">
          {feedback && (
            <span className="mr-1 text-xs text-emerald-600 dark:text-emerald-400">{feedback}</span>
          )}
          <IconButton label="Deschide în cititor" onClick={() => onOpen?.(result)}>
            <BookOpenIcon />
          </IconButton>
          <IconButton label="Copiază versetul" onClick={handleCopy}>
            <CopyIcon />
          </IconButton>
        </div>
      </div>

      <p className="leading-relaxed text-slate-700 dark:text-slate-300">
        {renderHighlighted(result.text, result.matches)}
      </p>
    </li>
  );
}

function IconButton({ label, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className="rounded-md p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200"
    >
      {children}
    </button>
  );
}

/**
 * Construiește fragmentele de text cu termenii găsiți în <mark>.
 * `matches` sunt offset-uri în textul original (norm() păstrează lungimea, deci 1:1).
 */
function renderHighlighted(text, matches) {
  if (!matches || matches.length === 0) return text;
  const parts = [];
  let last = 0;
  matches.forEach((m, i) => {
    if (m.start > last) parts.push(text.slice(last, m.start));
    parts.push(
      <mark
        key={i}
        className="rounded bg-yellow-200 px-0.5 text-slate-900 dark:bg-yellow-400/30 dark:text-yellow-100"
      >
        {text.slice(m.start, m.end)}
      </mark>
    );
    last = m.end;
  });
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

function BookOpenIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

import { useEffect, useRef, useState } from 'react';
import CrossRefsList from './CrossRefsList.jsx';
import { copyText } from '../lib/clipboard.js';
import { useAnnotations, toggleBookmark, verseKey, highlightBg } from '../lib/annotations.js';
import { getCrossRefs } from '../lib/crossrefs.js';

export default function VerseCard({ result, attribution, translation = null, onOpen, index = null, selected = false }) {
  const [feedback, setFeedback] = useState('');
  const [refsOpen, setRefsOpen] = useState(false);
  const timer = useRef(null);

  // Trimiterile versetului, vizibile direct de pe card (fără să deschizi cititorul).
  const refs = translation ? getCrossRefs(result.abbrev, result.chapter, result.verse) : [];

  // Adnotările acestui verset (sincron cu cititorul și pagina Salvate):
  // semn de carte pe buton, evidențierea colorează textul versetului.
  const ann = useAnnotations();
  const k = verseKey(result.abbrev, result.chapter, result.verse);
  const saved = !!ann.bookmarks[k];
  const hlBg = highlightBg(ann.highlights[k]);

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

  function handleBookmark() {
    toggleBookmark(k);
    flash(saved ? 'Scos din salvate' : 'Salvat!');
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
          <IconButton
            label={saved ? 'Scoate semnul de carte' : 'Salvează versetul (semn de carte)'}
            onClick={handleBookmark}
            active={saved}
          >
            <BookmarkIcon filled={saved} />
          </IconButton>
          <IconButton label="Deschide în cititor" onClick={() => onOpen?.(result)}>
            <BookOpenIcon />
          </IconButton>
          <IconButton label="Copiază versetul" onClick={handleCopy}>
            <CopyIcon />
          </IconButton>
        </div>
      </div>

      <p
        className={
          'leading-relaxed text-slate-700 dark:text-slate-300' +
          (hlBg ? ' rounded-md px-1.5 py-0.5 ' + hlBg : '')
        }
      >
        {renderHighlighted(result.text, result.matches)}
      </p>

      {refs.length > 0 && (
        <div className="mt-2">
          <button
            type="button"
            onClick={() => setRefsOpen((o) => !o)}
            aria-expanded={refsOpen}
            title="Versete înrudite (trimiteri)"
            className="inline-flex items-center gap-1 rounded-md px-1.5 py-1 text-xs font-medium text-slate-500 transition hover:bg-slate-100 hover:text-slate-700 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-200"
          >
            <ChevronIcon open={refsOpen} />
            Trimiteri ({refs.length})
          </button>
          {refsOpen && (
            <div className="mt-1 border-t border-slate-100 pt-1 dark:border-slate-800">
              <CrossRefsList translation={translation} refs={refs} onGoTo={(pos) => onOpen?.(pos)} />
            </div>
          )}
        </div>
      )}
    </li>
  );
}

function ChevronIcon({ open }) {
  return (
    <svg
      width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
      className={'transition-transform ' + (open ? 'rotate-90' : '')}
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

function IconButton({ label, onClick, active = false, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      aria-pressed={active || undefined}
      className={
        'rounded-md p-1.5 transition ' +
        (active
          ? 'text-amber-500 hover:bg-amber-50 hover:text-amber-600 dark:text-amber-400 dark:hover:bg-slate-800 dark:hover:text-amber-300'
          : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-200')
      }
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

function BookmarkIcon({ filled }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
    </svg>
  );
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

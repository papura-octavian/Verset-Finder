import { useEffect } from 'react';

// Paginile aplicației (sertarul ☰). Iconițele sunt inline, în stilul celorlalte.
const PAGES = [
  { id: 'search', label: 'Caută', icon: SearchIcon, desc: 'Caută cuvinte sau referințe' },
  { id: 'read', label: 'Citește', icon: BookIcon, desc: 'Citește Biblia capitol cu capitol' },
];

/**
 * Sertar de navigație din stânga (deschis de butonul ☰ din bara de sus).
 * Backdrop + Escape + click pe fundal îl închid; alegerea unei pagini navighează
 * și închide. Pe telefon ocupă ~80vw (max 320px), pe desktop aceeași lățime fixă.
 */
export default function NavDrawer({ open, view, onNavigate, onClose }) {
  // Închide cu Escape cât e deschis.
  useEffect(() => {
    if (!open) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="Meniu de navigație"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <nav className="flex h-full w-[80vw] max-w-80 flex-col gap-1 bg-white p-3 shadow-2xl dark:bg-slate-900">
        <div className="mb-2 flex items-center justify-between px-1">
          <span className="text-sm font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Meniu
          </span>
          <button
            type="button"
            onClick={onClose}
            title="Închide meniul (Esc)"
            aria-label="Închide meniul"
            className="rounded-lg p-1.5 text-slate-500 transition hover:bg-slate-100 hover:text-slate-800 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <CloseIcon />
          </button>
        </div>

        {PAGES.map((p) => {
          const Icon = p.icon;
          const active = view === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => {
                onNavigate(p.id);
                onClose();
              }}
              aria-current={active ? 'page' : undefined}
              className={
                'flex items-center gap-3 rounded-xl px-3 py-3 text-left transition ' +
                (active
                  ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')
              }
            >
              <Icon />
              <span className="flex min-w-0 flex-col">
                <span className="font-semibold">{p.label}</span>
                <span className={'truncate text-xs ' + (active ? 'text-slate-300 dark:text-slate-600' : 'text-slate-400 dark:text-slate-500')}>
                  {p.desc}
                </span>
              </span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}

function SearchIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  );
}

function BookIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
      <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

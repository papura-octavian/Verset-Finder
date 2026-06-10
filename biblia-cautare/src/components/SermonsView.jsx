import { useEffect, useRef, useState } from 'react';
import Markdown from './Markdown.jsx';
import {
  useSermons,
  createSermon,
  updateSermon,
  flushSermon,
  deleteSermon,
  reorderSermon,
  TEMPLATES,
} from '../lib/sermons.js';
import { parseReference, referenceVerses } from '../lib/reference.js';
import { norm } from '../lib/search.js';
import { useScrollLock } from '../lib/useScrollLock.js';

/**
 * Pagina „Predici" (Batch 4): panoul din stânga cu documentele salvate
 * (reordonabile), editor markdown cu toolbar pentru ne-tehnici, inserare
 * rapidă de versete după referință, previzualizare și mod prezentare.
 * Pe mobil: lista și editorul sunt ecrane separate (înapoi cu ‹).
 */
export default function SermonsView({ translation }) {
  const { loaded, sermons } = useSermons();
  const [activeId, setActiveId] = useState(null);
  const active = sermons.find((s) => s.id === activeId) || null;

  // Panoul de creare (titlu + șablon).
  const [creating, setCreating] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newTemplate, setNewTemplate] = useState('blank');

  function handleCreate() {
    const tpl = TEMPLATES.find((t) => t.id === newTemplate) || TEMPLATES[0];
    const s = createSermon(newTitle, tpl.body);
    setActiveId(s.id);
    setCreating(false);
    setNewTitle('');
    setNewTemplate('blank');
  }

  if (!loaded) {
    return <p className="py-12 text-center text-slate-400 dark:text-slate-500">Se încarcă predicile…</p>;
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
      {/* Panoul cu documente — pe mobil dispare cât e deschis un document. */}
      <aside className={(active ? 'hidden sm:flex' : 'flex') + ' w-full shrink-0 flex-col gap-2 sm:w-64'}>
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
            Predicile mele {sermons.length > 0 && `(${sermons.length})`}
          </h2>
          <button
            type="button"
            onClick={() => setCreating((c) => !c)}
            className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
          >
            + Nouă
          </button>
        </div>

        {creating && (
          <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleCreate();
                if (e.key === 'Escape') setCreating(false);
              }}
              autoFocus
              placeholder="Titlul predicii…"
              aria-label="Titlul predicii noi"
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-300"
            />
            <select
              value={newTemplate}
              onChange={(e) => setNewTemplate(e.target.value)}
              aria-label="Șablonul predicii noi"
              className="w-full rounded-lg border border-slate-300 bg-white px-2 py-2 text-sm text-slate-700 outline-none focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300 dark:focus:border-slate-300"
            >
              {TEMPLATES.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.label}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleCreate}
              className="w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
            >
              Creează
            </button>
          </div>
        )}

        {sermons.length === 0 && !creating ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-400 dark:border-slate-700 dark:text-slate-500">
            Nicio predică încă. Apasă „+ Nouă" ca să începi — poți porni de la un șablon.
          </p>
        ) : (
          <ul className="space-y-1.5">
            {sermons.map((s, i) => {
              const isActive = s.id === activeId;
              return (
                <li key={s.id} className="group flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => setActiveId(s.id)}
                    className={
                      'min-w-0 flex-1 rounded-xl border px-3 py-2 text-left transition ' +
                      (isActive
                        ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800')
                    }
                  >
                    <span className="block truncate text-sm font-semibold">{s.title}</span>
                    <span className={'block text-xs ' + (isActive ? 'text-slate-300 dark:text-slate-600' : 'text-slate-400 dark:text-slate-500')}>
                      {fmtDate(s.updatedAt)}
                    </span>
                  </button>
                  <span className="flex flex-col">
                    <ArrowBtn label="Mută mai sus" disabled={i === 0} onClick={() => reorderSermon(s.id, -1)} up />
                    <ArrowBtn label="Mută mai jos" disabled={i === sermons.length - 1} onClick={() => reorderSermon(s.id, 1)} />
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </aside>

      {/* Editorul / starea goală pe desktop. */}
      {active ? (
        <SermonEditor
          key={active.id}
          sermon={active}
          translation={translation}
          onBack={() => setActiveId(null)}
          onDelete={() => {
            deleteSermon(active.id);
            setActiveId(null);
          }}
        />
      ) : (
        <div className="hidden min-h-64 flex-1 items-center justify-center rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-400 sm:flex dark:border-slate-700 dark:text-slate-500">
          Alege o predică din listă sau creează una nouă.
        </div>
      )}
    </div>
  );
}

function SermonEditor({ sermon, translation, onBack, onDelete }) {
  const taRef = useRef(null);
  const [preview, setPreview] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [versePick, setVersePick] = useState(false);
  const [verseQuery, setVerseQuery] = useState('');
  const [verseError, setVerseError] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);

  // La părăsirea editorului, scrie pe disc orice salvare amânată.
  useEffect(() => () => flushSermon(sermon.id), [sermon.id]);

  // Aplică o transformare pe corpul documentului păstrând focusul și selecția.
  function edit(fn) {
    const ta = taRef.current;
    if (!ta) return;
    const { text, selStart, selEnd } = fn(sermon.body, ta.selectionStart, ta.selectionEnd);
    updateSermon(sermon.id, { body: text });
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(selStart, selEnd);
    });
  }

  // Învelește selecția (sau un placeholder) în marcaje inline: **bold**, *italic*.
  function wrap(before, after = before, placeholder = 'text') {
    edit((val, s, e) => {
      const sel = val.slice(s, e) || placeholder;
      const text = val.slice(0, s) + before + sel + after + val.slice(e);
      return { text, selStart: s + before.length, selEnd: s + before.length + sel.length };
    });
  }

  // Prefixează liniile selectate (titluri, liste, citat); numbered = 1. 2. 3.
  function linePrefix(prefix, numbered = false) {
    edit((val, s, e) => {
      const ls = val.lastIndexOf('\n', s - 1) + 1;
      let le = val.indexOf('\n', e);
      if (le === -1) le = val.length;
      const lines = val.slice(ls, le).split('\n');
      const prefixed = lines.map((l, i) => (numbered ? `${i + 1}. ` : prefix) + l).join('\n');
      const text = val.slice(0, ls) + prefixed + val.slice(le);
      return { text, selStart: ls, selEnd: ls + prefixed.length };
    });
  }

  // Inserează versetele unei referințe ca bloc-citat la poziția cursorului.
  function insertVerse() {
    const ref = parseReference(verseQuery, translation);
    if (!ref || ref.error) {
      setVerseError('Referință nevalidă. Ex: ioan 3:16, isaia 1:1-10, psalmii 23');
      return;
    }
    const verses = referenceVerses(translation, ref);
    if (!verses.length) {
      setVerseError('Capitolul sau versetul nu există în această carte.');
      return;
    }
    const name = verses[0].book;
    let md;
    if (verses.length === 1) {
      md = `> **${verses[0].ref}** — „${verses[0].text}” (${translation.attribution})\n\n`;
    } else {
      const label =
        ref.verseStart == null
          ? `${name} ${ref.chapter}`
          : `${name} ${ref.chapter}:${verses[0].verse}-${verses[verses.length - 1].verse}`;
      md =
        `> **${label}** (${translation.attribution})\n` +
        verses.map((v) => `> ${v.verse}. ${v.text}`).join('\n') +
        '\n\n';
    }
    edit((val, s, e) => {
      const lead = s > 0 && val[s - 1] !== '\n' ? '\n\n' : '';
      const ins = lead + md;
      const pos = s + ins.length;
      return { text: val.slice(0, s) + ins + val.slice(e), selStart: pos, selEnd: pos };
    });
    setVerseQuery('');
    setVerseError('');
    setVersePick(false);
  }

  // Descarcă documentul ca fișier .md (titlul devine numele fișierului).
  function downloadMd() {
    const content = sermon.body.trimStart().startsWith('# ')
      ? sermon.body
      : `# ${sermon.title}\n\n${sermon.body}`;
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (norm(sermon.title).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'predica') + '.md';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          title="Înapoi la listă"
          aria-label="Înapoi la lista de predici"
          className="shrink-0 rounded-lg border border-slate-200 bg-white p-2 text-slate-600 transition hover:bg-slate-100 sm:hidden dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          <ChevronLeft />
        </button>
        <input
          type="text"
          value={sermon.title}
          onChange={(e) => updateSermon(sermon.id, { title: e.target.value })}
          aria-label="Titlul predicii"
          className="min-w-0 flex-1 rounded-lg border border-transparent bg-transparent px-2 py-1.5 text-lg font-bold text-slate-900 outline-none transition hover:border-slate-200 focus:border-slate-900 dark:text-slate-100 dark:hover:border-slate-700 dark:focus:border-slate-300"
        />
      </div>

      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1.5 dark:border-slate-700 dark:bg-slate-900">
        <TbBtn label="Subtitlu" onClick={() => linePrefix('## ')} disabled={preview}>H2</TbBtn>
        <TbBtn label="Subtitlu mic" onClick={() => linePrefix('### ')} disabled={preview}>H3</TbBtn>
        <TbBtn label="Îngroșat" onClick={() => wrap('**')} disabled={preview}>
          <span className="font-bold">B</span>
        </TbBtn>
        <TbBtn label="Înclinat" onClick={() => wrap('*')} disabled={preview}>
          <span className="italic">I</span>
        </TbBtn>
        <TbBtn label="Listă cu puncte" onClick={() => linePrefix('- ')} disabled={preview}>•—</TbBtn>
        <TbBtn label="Listă numerotată" onClick={() => linePrefix('', true)} disabled={preview}>1.</TbBtn>
        <TbBtn label="Citat" onClick={() => linePrefix('> ')} disabled={preview}>„”</TbBtn>
        <TbBtn label="Inserează un verset după referință" onClick={() => setVersePick((v) => !v)} active={versePick} disabled={preview}>
          + Verset
        </TbBtn>

        <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />

        <TbBtn label={preview ? 'Înapoi la scriere' : 'Previzualizare'} onClick={() => setPreview((p) => !p)} active={preview}>
          <EyeIcon />
        </TbBtn>
        <TbBtn label="Mod prezentare (ecran întreg)" onClick={() => setPresenting(true)}>
          <PlayIcon />
        </TbBtn>
        <TbBtn label="Descarcă fișierul .md" onClick={downloadMd}>
          <DownloadIcon />
        </TbBtn>

        <span className="ml-auto" />
        {confirmDel ? (
          <span className="flex items-center gap-1">
            <button
              type="button"
              onClick={onDelete}
              className="rounded-md bg-red-600 px-2 py-1 text-xs font-semibold text-white transition hover:bg-red-700"
            >
              Șterge definitiv
            </button>
            <button
              type="button"
              onClick={() => setConfirmDel(false)}
              className="rounded-md border border-slate-300 px-2 py-1 text-xs text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Nu
            </button>
          </span>
        ) : (
          <TbBtn label="Șterge predica" onClick={() => setConfirmDel(true)}>
            <TrashIcon />
          </TbBtn>
        )}
      </div>

      {/* Alegerea versetului de inserat */}
      {versePick && !preview && (
        <div className="space-y-1 rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={verseQuery}
              onChange={(e) => {
                setVerseQuery(e.target.value);
                setVerseError('');
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') insertVerse();
                if (e.key === 'Escape') setVersePick(false);
              }}
              autoFocus
              placeholder="ex: ioan 3:16 · isaia 1:1-10 · psalmii 23"
              aria-label="Referința versetului de inserat"
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-300"
            />
            <button
              type="button"
              onClick={insertVerse}
              className="shrink-0 rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
            >
              Inserează
            </button>
          </div>
          {verseError && <p className="px-1 text-xs text-red-600 dark:text-red-400">{verseError}</p>}
        </div>
      )}

      {/* Corpul: scriere sau previzualizare */}
      {preview ? (
        <div className="min-h-[55vh] rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <Markdown text={sermon.body} />
        </div>
      ) : (
        <textarea
          ref={taRef}
          value={sermon.body}
          onChange={(e) => updateSermon(sermon.id, { body: e.target.value })}
          placeholder="Scrie predica aici… Folosește toolbar-ul pentru titluri, liste și versete."
          aria-label="Conținutul predicii"
          className="min-h-[55vh] w-full flex-1 resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-base leading-relaxed text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-300"
        />
      )}

      <p className="px-1 text-xs text-slate-400 dark:text-slate-500">
        Salvat automat · ultima modificare {fmtDate(sermon.updatedAt)}
      </p>

      {presenting && <PresentationOverlay sermon={sermon} onClose={() => setPresenting(false)} />}
    </div>
  );
}

/** Modul prezentare: tot documentul pe ecran întreg, text mare, serif. */
function PresentationOverlay({ sermon, onClose }) {
  useScrollLock();
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 overflow-y-auto bg-white dark:bg-slate-950"
      role="dialog"
      aria-modal="true"
      aria-label={`Prezentare: ${sermon.title}`}
    >
      <button
        type="button"
        onClick={onClose}
        title="Închide prezentarea (Esc)"
        aria-label="Închide prezentarea"
        className="fixed right-4 top-4 z-10 rounded-lg border border-slate-200 bg-white p-2 text-slate-500 shadow-sm transition hover:bg-slate-100 hover:text-slate-800 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
      >
        <CloseIcon />
      </button>
      <div className="mx-auto max-w-3xl px-6 py-10 sm:py-14">
        <Markdown
          text={sermon.body}
          className="font-serif text-xl leading-relaxed text-slate-900 sm:text-2xl dark:text-slate-100"
        />
      </div>
    </div>
  );
}

function fmtDate(at) {
  return new Date(at).toLocaleDateString('ro-RO', { day: 'numeric', month: 'short' }) +
    ', ' +
    new Date(at).toLocaleTimeString('ro-RO', { hour: '2-digit', minute: '2-digit' });
}

function TbBtn({ label, onClick, active = false, disabled = false, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      aria-pressed={active || undefined}
      className={
        'rounded-md px-2 py-1.5 text-sm leading-none transition disabled:cursor-not-allowed disabled:opacity-40 ' +
        (active
          ? 'bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900'
          : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800')
      }
    >
      {children}
    </button>
  );
}

function ArrowBtn({ label, onClick, disabled, up = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className="rounded p-0.5 text-slate-300 transition hover:bg-slate-100 hover:text-slate-600 disabled:cursor-not-allowed disabled:opacity-30 dark:text-slate-600 dark:hover:bg-slate-800 dark:hover:text-slate-300"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {up ? <path d="m18 15-6-6-6 6" /> : <path d="m6 9 6 6 6-6" />}
      </svg>
    </button>
  );
}

function ChevronLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m15 18-6-6 6-6" />
    </svg>
  );
}

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="6 3 20 12 6 21 6 3" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
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

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}

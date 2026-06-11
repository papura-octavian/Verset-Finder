import { useEffect, useRef, useState } from 'react';
import CrossRefsList from './CrossRefsList.jsx';
import CollectionPicker from './CollectionPicker.jsx';
import { copyText } from '../lib/clipboard.js';
import { HIGHLIGHT_COLORS, toggleBookmark, setHighlight, setNote, parseVerseKey } from '../lib/annotations.js';
import { getCrossRefs } from '../lib/crossrefs.js';
import { bookName } from '../lib/reader.js';

// Stiluri comune pentru butoanele-pastilă (aceeași linie ca subsolul cititorului).
const BTN = 'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs leading-none transition ';
const BTN_OFF = 'border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800';
const BTN_AMBER = 'border-amber-500 bg-amber-500 text-white dark:border-amber-400 dark:bg-amber-400 dark:text-slate-900';
const BTN_DARK = 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900';

/**
 * Bara de acțiuni a versetului selectat în cititor: semn de carte, evidențiere
 * pe culori, notă personală, copiere. Apare sub versetul atins în ChapterView.
 * Starea curentă vine ca props (părintele e abonat la store prin useAnnotations);
 * acțiunile scriu direct în store (annotations.js).
 */
export default function VerseActions({ verseKey: k, bookmarked, collection = null, color, note, copyPayload, translation, onGoTo }) {
  const [noteOpen, setNoteOpen] = useState(false);
  const [draft, setDraft] = useState('');
  const [copied, setCopied] = useState(false);
  const [refsOpen, setRefsOpen] = useState(false);
  const [collOpen, setCollOpen] = useState(false);
  const copyTimer = useRef(null);
  const textareaRef = useRef(null);

  // Trimiterile acestui verset (openbible.info / TSK), gata sortate după relevanță.
  const pos = parseVerseKey(k);
  const refs = getCrossRefs(pos.abbrev, pos.chapter, pos.verse);
  const refLabel = `${bookName(translation, pos.abbrev)} ${pos.chapter}:${pos.verse}`;

  useEffect(() => () => clearTimeout(copyTimer.current), []);

  // La deschiderea editorului pornește de la nota existentă; focus pe textarea.
  function openNote() {
    setDraft(note ? note.text : '');
    setNoteOpen(true);
  }
  useEffect(() => {
    if (noteOpen) textareaRef.current?.focus();
  }, [noteOpen]);

  async function handleCopy() {
    const ok = await copyText(copyPayload);
    setCopied(ok);
    clearTimeout(copyTimer.current);
    copyTimer.current = setTimeout(() => setCopied(false), 1800);
  }

  function saveNote() {
    setNote(k, draft);
    setNoteOpen(false);
  }

  function deleteNote() {
    setNote(k, '');
    setNoteOpen(false);
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-700 dark:bg-slate-950">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <button
          type="button"
          onClick={() => {
            // La salvare se deschide direct alegerea colecției (ca pe carduri).
            toggleBookmark(k);
            setCollOpen(!bookmarked);
          }}
          aria-pressed={bookmarked}
          title={bookmarked ? 'Scoate semnul de carte' : 'Salvează versetul (semn de carte)'}
          className={BTN + (bookmarked ? BTN_AMBER : BTN_OFF)}
        >
          <BookmarkIcon filled={bookmarked} />
          {bookmarked ? 'Salvat' : 'Salvează'}
        </button>

        {bookmarked && (
          <button
            type="button"
            onClick={() => setCollOpen((o) => !o)}
            aria-expanded={collOpen}
            title="Alege colecția semnului de carte"
            className={BTN + (collOpen ? BTN_DARK : BTN_OFF)}
          >
            <FolderIcon />
            {collection || 'Colecție'}
          </button>
        )}

        <span className="flex items-center gap-1.5" role="group" aria-label="Evidențiază pe culori">
          {HIGHLIGHT_COLORS.map((c) => {
            const active = color === c.id;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setHighlight(k, active ? null : c.id)}
                aria-pressed={active}
                title={active ? `Scoate evidențierea (${c.label})` : `Evidențiază cu ${c.label.toLowerCase()}`}
                className={
                  'h-5 w-5 rounded-full transition ' + c.dot + ' ' +
                  (active
                    ? 'ring-2 ring-slate-900 ring-offset-2 ring-offset-white dark:ring-slate-100 dark:ring-offset-slate-950'
                    : 'ring-1 ring-slate-300 hover:scale-110 dark:ring-slate-600')
                }
              />
            );
          })}
        </span>

        <button
          type="button"
          onClick={() => (noteOpen ? setNoteOpen(false) : openNote())}
          aria-pressed={!!note}
          title={note ? 'Vezi / editează nota' : 'Adaugă o notă personală'}
          className={BTN + (note ? BTN_DARK : BTN_OFF)}
        >
          <NoteIcon />
          Notă
        </button>

        <button
          type="button"
          onClick={handleCopy}
          title="Copiază versetul cu referință"
          className={BTN + BTN_OFF}
        >
          <CopyIcon />
          Copiază
        </button>

        {refs.length > 0 && (
          <button
            type="button"
            onClick={() => setRefsOpen((o) => !o)}
            aria-expanded={refsOpen}
            title="Versete înrudite (trimiteri)"
            className={BTN + (refsOpen ? BTN_DARK : BTN_OFF)}
          >
            <RefsIcon />
            Trimiteri ({refs.length})
          </button>
        )}

        {copied && <span className="text-xs text-emerald-600 dark:text-emerald-400">Copiat!</span>}
      </div>

      {bookmarked && collOpen && (
        <div className="mt-2">
          <CollectionPicker verseKey={k} refLabel={refLabel} onDone={() => setCollOpen(false)} />
        </div>
      )}

      {refsOpen && refs.length > 0 && (
        <div className="mt-2">
          <CrossRefsList translation={translation} refs={refs} onGoTo={onGoTo} />
        </div>
      )}

      {noteOpen && (
        <div className="mt-2 space-y-2">
          <textarea
            ref={textareaRef}
            rows={3}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Scrie o notă pentru acest verset…"
            aria-label="Notă personală pentru acest verset"
            onKeyDown={(e) => {
              // Esc închide doar editorul, nu și cititorul-overlay.
              if (e.key === 'Escape') {
                e.stopPropagation();
                setNoteOpen(false);
              }
            }}
            className="w-full resize-y rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-300"
          />
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={saveNote}
              className="rounded-md bg-slate-900 px-2.5 py-1 text-xs font-semibold text-white transition hover:bg-slate-700 dark:bg-slate-100 dark:text-slate-900 dark:hover:bg-slate-300"
            >
              Salvează nota
            </button>
            {note && (
              <button
                type="button"
                onClick={deleteNote}
                className="rounded-md border border-red-300 px-2.5 py-1 text-xs text-red-600 transition hover:bg-red-50 dark:border-red-900 dark:text-red-400 dark:hover:bg-red-950"
              >
                Șterge nota
              </button>
            )}
            <button
              type="button"
              onClick={() => setNoteOpen(false)}
              className="rounded-md border border-slate-300 px-2.5 py-1 text-xs text-slate-600 transition hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800"
            >
              Renunță
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function BookmarkIcon({ filled }) {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill={filled ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="m19 21-7-4-7 4V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16z" />
    </svg>
  );
}

function FolderIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z" />
    </svg>
  );
}

function RefsIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 14 20 9 15 4" />
      <path d="M4 20v-7a4 4 0 0 1 4-4h12" />
    </svg>
  );
}

function NoteIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

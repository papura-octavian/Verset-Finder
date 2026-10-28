import { useEffect, useMemo, useRef, useState } from 'react';
import Markdown from './Markdown.jsx';
import {
  useSermons,
  createSermon,
  updateSermon,
  flushSermon,
  deleteSermon,
  restoreSermon,
  duplicateSermon,
  reorderSermon,
  sermonMarkdown,
  sermonFileSlug,
  wordCount,
  speakingMinutes,
  TEMPLATES,
} from '../lib/sermons.js';
import { outline } from '../lib/mdBlocks.js';
import { norm } from '../lib/search.js';
import { loadJSON, saveJSON } from '../lib/storage.js';
import { downloadDocx } from '../lib/exportDocx.js';
import { downloadPdf } from '../lib/exportPdf.js';
import { parseReference, referenceVerses } from '../lib/reference.js';
import { useAnnotations, parseVerseKey, collectionNames, HIGHLIGHT_COLORS } from '../lib/annotations.js';
import { getChapterVerses, bookName } from '../lib/reader.js';
import { useScrollLock } from '../lib/useScrollLock.js';

// Sursele panoului „+ Verset": referință tastată sau direct din materialul
// personal (semne de carte, evidențieri, note) — fără să pleci din editor.
const PICK_TABS = [
  { id: 'ref', label: 'Referință' },
  { id: 'bookmarks', label: 'Salvate' },
  { id: 'highlights', label: 'Evidențieri' },
  { id: 'notes', label: 'Note' },
];

/**
 * Pagina „Predici" (Batch 4): panoul din stânga cu documentele salvate
 * (reordonabile), editor markdown cu toolbar pentru ne-tehnici, inserare
 * rapidă de versete (după referință sau din semnele de carte / evidențieri /
 * note personale), previzualizare și mod prezentare.
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

  // Căutare în predici (titlu și conținut, fără diacritice).
  const [filter, setFilter] = useState('');
  const shown = useMemo(() => {
    const tokens = norm(filter).trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) return sermons;
    return sermons.filter((s) => {
      const hay = norm(s.title + '\n' + s.body);
      return tokens.every((t) => hay.includes(t));
    });
  }, [sermons, filter]);

  // Ultima predică ștearsă poate fi readusă câteva secunde („Anulează").
  const [deleted, setDeleted] = useState(null);
  useEffect(() => {
    if (!deleted) return undefined;
    const t = setTimeout(() => setDeleted(null), 8000);
    return () => clearTimeout(t);
  }, [deleted]);

  if (!loaded) {
    return <p className="py-12 text-center text-slate-400 dark:text-slate-500">Se încarcă predicile…</p>;
  }

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-6">
      {/* Panoul cu documente — pe mobil dispare cât e deschis un document;
          pe desktop stă lipicios în stânga, ca sidebar-ul din Obsidian. */}
      <aside
        className={
          (active ? 'hidden sm:flex' : 'flex') +
          ' w-full shrink-0 flex-col gap-2 sm:sticky sm:top-6 sm:max-h-[calc(100vh-6rem)] sm:w-64 sm:overflow-y-auto lg:w-72'
        }
      >
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

        {sermons.length > 3 && (
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Caută în predici…"
            aria-label="Caută în predici"
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-300"
          />
        )}

        {sermons.length === 0 && !creating ? (
          <p className="rounded-xl border border-dashed border-slate-300 p-4 text-center text-sm text-slate-400 dark:border-slate-700 dark:text-slate-500">
            Nicio predică încă. Apasă „+ Nouă" ca să începi — poți porni de la un șablon.
          </p>
        ) : shown.length === 0 ? (
          <p className="px-1 py-3 text-center text-sm text-slate-400 dark:text-slate-500">Nicio predică nu conține „{filter}”.</p>
        ) : (
          <ul className="space-y-1.5">
            {shown.map((s, i) => {
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
                  {/* Reordonarea are sens doar pe lista completă, nu pe cea filtrată. */}
                  {!filter.trim() && (
                    <span className="flex flex-col">
                      <ArrowBtn label="Mută mai sus" disabled={i === 0} onClick={() => reorderSermon(s.id, -1)} up />
                      <ArrowBtn label="Mută mai jos" disabled={i === sermons.length - 1} onClick={() => reorderSermon(s.id, 1)} />
                    </span>
                  )}
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
          onDuplicate={() => {
            const copy = duplicateSermon(active.id);
            if (copy) setActiveId(copy.id);
          }}
          onDelete={() => {
            setDeleted(deleteSermon(active.id));
            setActiveId(null);
          }}
        />
      ) : (
        <div className="hidden flex-1 items-center justify-center rounded-xl border border-dashed border-slate-300 p-8 text-center text-slate-400 sm:flex sm:min-h-[70vh] dark:border-slate-700 dark:text-slate-500">
          Alege o predică din listă sau creează una nouă.
        </div>
      )}

      {deleted && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-20 z-40 mx-auto flex max-w-sm items-center justify-between gap-3 rounded-xl bg-slate-900 px-4 py-3 text-sm text-white shadow-xl sm:bottom-6 dark:bg-slate-100 dark:text-slate-900"
        >
          <span className="truncate">„{deleted.title}” a fost ștearsă.</span>
          <button
            type="button"
            onClick={() => {
              restoreSermon(deleted);
              setActiveId(deleted.id);
              setDeleted(null);
            }}
            className="shrink-0 font-semibold text-amber-300 hover:underline dark:text-amber-600"
          >
            Anulează
          </button>
        </div>
      )}
    </div>
  );
}

function SermonEditor({ sermon, translation, onBack, onDelete, onDuplicate }) {
  const taRef = useRef(null);
  const [preview, setPreview] = useState(false);
  const [presenting, setPresenting] = useState(false);
  const [versePick, setVersePick] = useState(false);
  const [pickTab, setPickTab] = useState('ref');
  const [pickColl, setPickColl] = useState('all');
  const [verseQuery, setVerseQuery] = useState('');
  const [verseError, setVerseError] = useState('');
  const [confirmDel, setConfirmDel] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const previewRef = useRef(null);

  // Cuprinsul (titlurile) și cât durează predica rostită.
  const sections = useMemo(() => outline(sermon.body), [sermon.body]);
  const words = useMemo(() => wordCount(sermon.body), [sermon.body]);

  // Sare la secțiunea i: în previzualizare la titlu, în editor cu cursorul pe rândul lui.
  function jumpTo(i) {
    if (preview) {
      previewRef.current?.querySelectorAll('h1,h2,h3')[i]?.scrollIntoView({ block: 'start', behavior: 'smooth' });
      return;
    }
    const ta = taRef.current;
    if (!ta) return;
    const lines = sermon.body.split('\n');
    const pos = lines.slice(0, sections[i].line).reduce((n, l) => n + l.length + 1, 0);
    ta.focus();
    ta.setSelectionRange(pos, pos);
    ta.scrollTop = Math.max(0, caretTop(ta, pos) - 16);
  }

  // Materialul personal pentru taburile din „+ Verset" (textul vine din
  // traducerea activă, ca în pagina Salvate).
  const ann = useAnnotations();
  const collections = useMemo(() => collectionNames(ann.bookmarks), [ann.bookmarks]);
  const savedRows = useMemo(() => {
    const row = (key) => {
      const { abbrev, chapter, verse } = parseVerseKey(key);
      return {
        key,
        order: (translation.books[abbrev]?.order ?? 999) * 1e6 + chapter * 1e3 + verse,
        ref: `${bookName(translation, abbrev)} ${chapter}:${verse}`,
        text: getChapterVerses(translation, abbrev, chapter)?.[verse - 1] ?? '',
      };
    };
    return {
      // Semne de carte și note: cele mai recente primele; evidențieri: ordine canonică.
      bookmarks: Object.entries(ann.bookmarks)
        .sort((a, b) => b[1].at - a[1].at)
        .map(([key, b]) => ({ ...row(key), collection: b.collection })),
      highlights: Object.entries(ann.highlights)
        .map(([key, color]) => ({ ...row(key), color }))
        .sort((a, b) => a.order - b.order),
      notes: Object.entries(ann.notes)
        .sort((a, b) => b[1].at - a[1].at)
        .map(([key, n]) => ({ ...row(key), noteText: n.text })),
    };
  }, [ann, translation]);

  // La părăsirea editorului, scrie pe disc orice salvare amânată.
  useEffect(() => () => flushSermon(sermon.id), [sermon.id]);

  // --- Istoric propriu de undo/redo (Ctrl+Z / Ctrl+Y) ---
  // Textarea e controlată din store și toolbar-ul îi rescrie valoarea programatic,
  // ceea ce strică istoricul nativ al browserului — așa că îl ținem noi aici.
  // Istoricul e per document (componenta se remontează cu key={id}).
  const history = useRef({ undo: [], redo: [], lastInput: 0 });

  // Salvează starea curentă în istoric. Tastarea continuă e grupată: un pas de
  // undo nou începe doar după o pauză (nu la un interval fix de la ultimul pas,
  // altfel un paragraf scris dintr-o suflare se anula tot odată).
  // Operațiile din toolbar forțează un pas separat.
  function pushHistory(force = false) {
    const h = history.current;
    const now = Date.now();
    const paused = now - h.lastInput > 600;
    h.lastInput = now;
    if (!force && !paused) return;
    h.undo.push({ val: sermon.body, sel: taRef.current ? taRef.current.selectionStart : sermon.body.length });
    if (h.undo.length > 200) h.undo.shift();
    h.redo = [];
  }

  function applySnapshot(snap, stackForCurrent) {
    const h = history.current;
    stackForCurrent.push({ val: sermon.body, sel: taRef.current ? taRef.current.selectionStart : 0 });
    h.lastInput = 0; // următoarea tastare începe un pas nou de undo
    const scrollTop = taRef.current ? taRef.current.scrollTop : 0;
    updateSermon(sermon.id, { body: snap.val });
    requestAnimationFrame(() => {
      taRef.current?.focus();
      taRef.current?.setSelectionRange(snap.sel, snap.sel);
      if (taRef.current) taRef.current.scrollTop = scrollTop;
    });
  }

  function undoEdit() {
    const snap = history.current.undo.pop();
    if (snap) applySnapshot(snap, history.current.redo);
  }

  function redoEdit() {
    const snap = history.current.redo.pop();
    if (snap) applySnapshot(snap, history.current.undo);
  }

  // Aplică o transformare pe corpul documentului păstrând focusul și selecția.
  // scrollTop trebuie salvat/restaurat manual: rescrierea valorii mută cursorul
  // la final și focus() derulează acolo, iar setSelectionRange nu derulează înapoi.
  function edit(fn) {
    const ta = taRef.current;
    if (!ta) return;
    pushHistory(true);
    const { text, selStart, selEnd } = fn(sermon.body, ta.selectionStart, ta.selectionEnd);
    const scrollTop = ta.scrollTop;
    updateSermon(sermon.id, { body: text });
    requestAnimationFrame(() => {
      ta.focus();
      ta.setSelectionRange(selStart, selEnd);
      ta.scrollTop = scrollTop;
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

  // Tab = indentare cu două spații (Shift+Tab scoate indentarea); pe selecții
  // de mai multe linii lucrează linie cu linie, ca în VS Code / Obsidian.
  function indentSelection(outdent) {
    edit((val, s, e) => {
      const multi = val.slice(s, e).includes('\n');
      const lineStart = val.lastIndexOf('\n', s - 1) + 1;
      // Pe un punct de listă, Tab îl face sub-punct (indentează tot rândul), ca în Word/Docs.
      const onListItem = /^\s*([-*]|\d+[.)])\s/.test(val.slice(lineStart));
      if (!outdent && !multi && s === e && !onListItem) {
        const text = val.slice(0, s) + '  ' + val.slice(e);
        return { text, selStart: s + 2, selEnd: s + 2 };
      }
      if (!multi && s === e && onListItem) {
        const line = val.slice(lineStart);
        const removed = outdent ? (line.match(/^( {1,2}|\t)/)?.[0].length ?? 0) : -2;
        const text = outdent ? val.slice(0, lineStart) + line.slice(removed) : val.slice(0, lineStart) + '  ' + line;
        const pos = Math.max(lineStart, s - removed);
        return { text, selStart: pos, selEnd: pos };
      }
      const ls = val.lastIndexOf('\n', s - 1) + 1;
      let le = val.indexOf('\n', e);
      if (le === -1) le = val.length;
      const lines = val.slice(ls, le).split('\n');
      const changed = lines.map((l) => (outdent ? l.replace(/^( {1,2}|\t)/, '') : '  ' + l)).join('\n');
      const text = val.slice(0, ls) + changed + val.slice(le);
      return { text, selStart: ls, selEnd: ls + changed.length };
    });
  }

  // Enter pe o linie de listă/citat continuă marcajul pe linia următoare
  // (numerele cresc); Enter pe un element gol scoate marcajul (închide lista).
  // Întoarce true dacă a gestionat tasta.
  function continueList(e) {
    const ta = taRef.current;
    if (!ta || ta.selectionStart !== ta.selectionEnd) return false;
    const s = ta.selectionStart;
    const val = sermon.body;
    const ls = val.lastIndexOf('\n', s - 1) + 1;
    let le = val.indexOf('\n', s);
    if (le === -1) le = val.length;
    const line = val.slice(ls, le);
    const m = line.match(/^(\s*)([-*]\s|>\s?|(\d+)([.)])\s)(.*)$/);
    if (!m) return false;
    e.preventDefault();
    if (!m[5].trim()) {
      // element gol → scoate marcajul și lasă o linie liberă
      edit((v) => {
        const text = v.slice(0, ls) + v.slice(ls + line.length);
        return { text, selStart: ls, selEnd: ls };
      });
      return true;
    }
    const marker = m[3] != null ? `${parseInt(m[3], 10) + 1}${m[4]} ` : m[2].trim() + ' ';
    edit((v, ss, ee) => {
      const ins = '\n' + m[1] + marker;
      const pos = ss + ins.length;
      return { text: v.slice(0, ss) + ins + v.slice(ee), selStart: pos, selEnd: pos };
    });
    return true;
  }

  // „@ioan 3:16" singur pe un rând + Enter → rândul devine citatul versetului.
  // Întoarce true dacă a gestionat tasta.
  function expandReferenceLine(e) {
    const ta = taRef.current;
    if (!ta || ta.selectionStart !== ta.selectionEnd) return false;
    const s = ta.selectionStart;
    const val = sermon.body;
    const ls = val.lastIndexOf('\n', s - 1) + 1;
    let le = val.indexOf('\n', s);
    if (le === -1) le = val.length;
    const line = val.slice(ls, le);
    if (!/^\s*@\S/.test(line) || s !== le) return false;
    const md = verseMarkdown(line.trim());
    if (!md) return false;
    e.preventDefault();
    edit((v) => {
      const text = v.slice(0, ls) + md + v.slice(le);
      const pos = ls + md.length;
      return { text, selStart: pos, selEnd: pos };
    });
    return true;
  }

  // Comenzile de editor au prioritate în textarea (Tab nu mai mută focusul).
  function handleKeyDown(e) {
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (mod && !e.shiftKey && k === 'z') { e.preventDefault(); undoEdit(); return; }
    if ((mod && k === 'y') || (mod && e.shiftKey && k === 'z')) { e.preventDefault(); redoEdit(); return; }
    if (mod && k === 'b') { e.preventDefault(); wrap('**'); return; }
    if (mod && k === 'i') { e.preventDefault(); wrap('*'); return; }
    if (e.key === 'Tab') { e.preventDefault(); indentSelection(e.shiftKey); return; }
    if (e.key === 'Enter' && !mod && !e.shiftKey) {
      if (expandReferenceLine(e)) return;
      continueList(e);
    }
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

  // Markdown-ul (bloc-citat) pentru o referință, sau null dacă nu e validă.
  function verseMarkdown(query) {
    const ref = parseReference(query, translation);
    if (!ref || ref.error) return null;
    const verses = referenceVerses(translation, ref);
    if (!verses.length) return null;
    const name = verses[0].book;
    if (verses.length === 1) {
      return `> **${verses[0].ref}** — „${verses[0].text}” (${translation.attribution})\n\n`;
    }
    const label =
      ref.verseStart == null
        ? `${name} ${ref.chapter}`
        : `${name} ${ref.chapter}:${verses[0].verse}-${verses[verses.length - 1].verse}`;
    return (
      `> **${label}** (${translation.attribution})\n` +
      verses.map((v) => `> ${v.verse}. ${v.text}`).join('\n') +
      '\n\n'
    );
  }

  // Inserează versetele unei referințe ca bloc-citat la poziția cursorului.
  function insertVerse() {
    const ref = parseReference(verseQuery, translation);
    if (!ref || ref.error) {
      setVerseError('Referință nevalidă. Ex: ioan 3:16, isaia 1:1-10, psalmii 23');
      return;
    }
    const md = verseMarkdown(verseQuery);
    if (!md) {
      setVerseError('Capitolul sau versetul nu există în această carte.');
      return;
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

  // Inserează un rând din taburile Salvate/Evidențieri/Note ca bloc-citat;
  // nota personală vine sub verset. Panoul rămâne deschis (poți adăuga mai multe).
  function insertSavedRow(r) {
    let md = `> **${r.ref}** — „${r.text}” (${translation.attribution})\n`;
    if (r.noteText) md += `>\n> *Notă:* ${r.noteText.replace(/\n/g, '\n> ')}\n`;
    md += '\n';
    edit((val, s, e) => {
      const lead = s > 0 && val[s - 1] !== '\n' ? '\n\n' : '';
      const ins = lead + md;
      const pos = s + ins.length;
      return { text: val.slice(0, s) + ins + val.slice(e), selStart: pos, selEnd: pos };
    });
  }

  // Descarcă documentul ca fișier .md (titlul devine numele fișierului).
  function downloadMd() {
    const blob = new Blob([sermonMarkdown(sermon)], { type: 'text/markdown;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = sermonFileSlug(sermon.title) + '.md';
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // Lista activă din panoul „+ Verset" (cu filtrul de colecție pe Salvate).
  const pickList =
    pickTab === 'bookmarks' && pickColl !== 'all'
      ? savedRows.bookmarks.filter((r) => r.collection === pickColl)
      : savedRows[pickTab] ?? [];

  return (
    /* Editorul umple tot spațiul rămas după sidebar — lat, cât chenarul
       punctat al stării goale, pe orice ecran. */
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
        <TbBtn
          label="Separator (în modul prezentare începe un slide nou)"
          onClick={() =>
            edit((val, s, e) => {
              const lead = s > 0 && val[s - 1] !== '\n' ? '\n\n' : s > 0 && val[s - 2] !== '\n' ? '\n' : '';
              const ins = lead + '---\n\n';
              const pos = s + ins.length;
              return { text: val.slice(0, s) + ins + val.slice(e), selStart: pos, selEnd: pos };
            })
          }
          disabled={preview}
        >
          ―
        </TbBtn>
        <TbBtn label="Inserează un verset (după referință sau din salvate). Sau scrie @ioan 3:16 pe un rând și apasă Enter." onClick={() => setVersePick((v) => !v)} active={versePick} disabled={preview}>
          + Verset
        </TbBtn>

        <span className="mx-1 h-5 w-px bg-slate-200 dark:bg-slate-700" />

        <TbBtn label="Cuprins (sari la o secțiune)" onClick={() => setOutlineOpen((o) => !o)} active={outlineOpen} disabled={!sections.length}>
          <ListIcon />
        </TbBtn>
        <TbBtn label={preview ? 'Înapoi la scriere' : 'Previzualizare'} onClick={() => setPreview((p) => !p)} active={preview}>
          <EyeIcon />
        </TbBtn>
        <TbBtn label="Mod prezentare (ecran întreg)" onClick={() => setPresenting(true)}>
          <PlayIcon />
        </TbBtn>
        {/* Meniul de export: .md brut sau formatat ca Word/PDF. */}
        <span className="relative" onKeyDown={(e) => e.key === 'Escape' && setExportOpen(false)}>
          <TbBtn label="Exportă predica (.md, .docx, .pdf)" onClick={() => setExportOpen((o) => !o)} active={exportOpen}>
            <DownloadIcon />
          </TbBtn>
          {exportOpen && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setExportOpen(false)} />
              <div className="absolute left-0 top-full z-20 mt-1 w-44 rounded-lg border border-slate-200 bg-white p-1 shadow-lg sm:left-auto sm:right-0 dark:border-slate-700 dark:bg-slate-900">
                <ExportItem onClick={() => { downloadMd(); setExportOpen(false); }}>
                  Fișier markdown (.md)
                </ExportItem>
                <ExportItem onClick={() => { downloadDocx(sermon); setExportOpen(false); }}>
                  Word (.docx)
                </ExportItem>
                <ExportItem onClick={() => { downloadPdf(sermon); setExportOpen(false); }}>
                  PDF (.pdf)
                </ExportItem>
              </div>
            </>
          )}
        </span>

        <span className="ml-auto" />
        <TbBtn label="Fă o copie a predicii" onClick={onDuplicate}>
          <CopyIcon />
        </TbBtn>
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

      {/* Cuprinsul: titlurile documentului, click = salt la secțiune */}
      {outlineOpen && sections.length > 0 && (
        <nav aria-label="Cuprinsul predicii" className="rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
          <ul className="max-h-56 space-y-0.5 overflow-y-auto">
            {sections.map((s, i) => (
              <li key={i}>
                <button
                  type="button"
                  onClick={() => jumpTo(i)}
                  className={
                    'w-full truncate rounded-md px-2 py-1 text-left text-sm transition hover:bg-slate-100 dark:hover:bg-slate-800 ' +
                    (s.level === 1 ? 'font-semibold text-slate-900 dark:text-slate-100' : s.level === 2 ? 'pl-4 text-slate-700 dark:text-slate-300' : 'pl-7 text-slate-500 dark:text-slate-400')
                  }
                >
                  {s.title}
                </button>
              </li>
            ))}
          </ul>
        </nav>
      )}

      {/* Alegerea versetului de inserat: după referință sau din materialul personal */}
      {versePick && !preview && (
        <div className="space-y-2 rounded-xl border border-slate-200 bg-white p-2 dark:border-slate-700 dark:bg-slate-900">
          <div className="flex flex-wrap items-center gap-1.5" role="tablist" aria-label="Sursa versetului de inserat">
            {PICK_TABS.map((t) => {
              const n = t.id === 'ref' ? null : savedRows[t.id].length;
              const active = pickTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setPickTab(t.id)}
                  className={
                    'rounded-full border px-2.5 py-1 text-xs transition ' +
                    (active
                      ? 'border-slate-900 bg-slate-900 text-white dark:border-slate-100 dark:bg-slate-100 dark:text-slate-900'
                      : 'border-slate-300 text-slate-600 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-800')
                  }
                >
                  {t.label}
                  {n != null && ` (${n})`}
                </button>
              );
            })}
          </div>

          {pickTab === 'ref' ? (
            <>
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
            </>
          ) : (
            <>
              {pickTab === 'bookmarks' && collections.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Filtru de colecții">
                  <button
                    type="button"
                    onClick={() => setPickColl('all')}
                    aria-pressed={pickColl === 'all'}
                    className={
                      'rounded-full border px-2 py-0.5 text-xs transition ' +
                      (pickColl === 'all'
                        ? 'border-slate-500 bg-slate-100 font-semibold text-slate-900 dark:border-slate-400 dark:bg-slate-800 dark:text-slate-100'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800')
                    }
                  >
                    Toate
                  </button>
                  {collections.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setPickColl(c)}
                      aria-pressed={pickColl === c}
                      className={
                        'rounded-full border px-2 py-0.5 text-xs transition ' +
                        (pickColl === c
                          ? 'border-slate-500 bg-slate-100 font-semibold text-slate-900 dark:border-slate-400 dark:bg-slate-800 dark:text-slate-100'
                          : 'border-slate-200 text-slate-500 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-400 dark:hover:bg-slate-800')
                      }
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}

              {pickList.length === 0 ? (
                <p className="px-1 py-2 text-center text-xs text-slate-400 dark:text-slate-500">
                  {pickTab === 'bookmarks'
                    ? pickColl !== 'all'
                      ? 'Nicio salvare în această colecție.'
                      : 'Niciun verset salvat încă — folosește semnul de carte din căutare sau cititor.'
                    : pickTab === 'highlights'
                      ? 'Nicio evidențiere încă — atinge un verset în cititor și alege o culoare.'
                      : 'Nicio notă încă — atinge un verset în cititor și apasă „Notă".'}
                </p>
              ) : (
                <ul className="max-h-64 space-y-0.5 overflow-y-auto">
                  {pickList.map((r) => (
                    <li key={r.key}>
                      <button
                        type="button"
                        onClick={() => insertSavedRow(r)}
                        title="Inserează în predică (la poziția cursorului)"
                        className="w-full rounded-lg px-2 py-1.5 text-left transition hover:bg-slate-100 dark:hover:bg-slate-800"
                      >
                        <span className="flex items-center gap-2">
                          {r.color && (
                            <span
                              className={
                                'h-2.5 w-2.5 shrink-0 rounded-full ' +
                                (HIGHLIGHT_COLORS.find((c) => c.id === r.color)?.dot ?? 'bg-slate-300')
                              }
                            />
                          )}
                          <span className="shrink-0 text-sm font-semibold text-slate-900 dark:text-slate-100">{r.ref}</span>
                          <span className="truncate text-xs text-slate-500 dark:text-slate-400">{r.text}</span>
                        </span>
                        {r.noteText && (
                          <span className="block truncate text-xs italic text-slate-400 dark:text-slate-500">
                            Notă: {r.noteText}
                          </span>
                        )}
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      {/* Corpul: scriere sau previzualizare */}
      {preview ? (
        <div ref={previewRef} className="min-h-[55vh] rounded-xl border border-slate-200 bg-white px-4 py-3 text-base text-slate-800 sm:min-h-[68vh] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200">
          <Markdown text={sermon.body} />
        </div>
      ) : (
        <textarea
          ref={taRef}
          value={sermon.body}
          onChange={(e) => {
            pushHistory();
            updateSermon(sermon.id, { body: e.target.value });
          }}
          onKeyDown={handleKeyDown}
          placeholder="Scrie predica aici… Folosește toolbar-ul pentru titluri, liste și versete."
          aria-label="Conținutul predicii"
          className="min-h-[55vh] w-full flex-1 resize-y rounded-xl border border-slate-200 bg-white px-4 py-3 text-base leading-relaxed text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-slate-900 sm:min-h-[68vh] dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500 dark:focus:border-slate-300"
        />
      )}

      <p className="flex flex-wrap gap-x-1 px-1 text-xs text-slate-400 dark:text-slate-500">
        <span>Salvat automat · ultima modificare {fmtDate(sermon.updatedAt)}</span>
        {words > 0 && (
          <span title="Estimare la un ritm obișnuit de predicare (~130 de cuvinte pe minut)">
            · {words.toLocaleString('ro-RO')} cuvinte · ~{speakingMinutes(words)} min de vorbit
          </span>
        )}
      </p>

      {presenting && <PresentationOverlay sermon={sermon} onClose={() => setPresenting(false)} />}
    </div>
  );
}

// Mărimile textului în prezentare (rem), alese cu A− / A+ și ținute minte.
const PRES_KEY = 'biblia:presentation';
const PRES_SIZES = [1.15, 1.35, 1.6, 2, 2.5, 3];

/**
 * Împarte predica în slide-uri: unul nou la fiecare titlu „##" (sau „#" după
 * începutul documentului) și la fiecare separator „---". Fără astfel de repere
 * rămâne un singur slide, care se derulează ca un text întreg.
 */
function splitSlides(body) {
  const slides = [];
  let cur = [];
  const flush = () => {
    if (cur.join('').trim()) slides.push(cur.join('\n'));
    cur = [];
  };
  for (const line of (body || '').split('\n')) {
    if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      flush();
      continue;
    }
    if (/^#{1,2}\s/.test(line) && cur.join('').trim()) flush();
    cur.push(line);
  }
  flush();
  return slides.length ? slides : [''];
}

/**
 * Modul prezentare pe tot ecranul: slide-uri (← → / Spațiu / click), text mare
 * reglabil, cronometru și ecran complet; sau tot textul derulat, ca înainte.
 */
function PresentationOverlay({ sermon, onClose }) {
  useScrollLock();
  const slides = useMemo(() => splitSlides(sermon.body), [sermon.body]);
  const [mode, setMode] = useState(slides.length > 1 ? 'slides' : 'scroll');
  const [index, setIndex] = useState(0);
  const [size, setSize] = useState(() => {
    const p = loadJSON(PRES_KEY, null);
    return p && Number.isInteger(p.size) ? Math.min(PRES_SIZES.length - 1, Math.max(0, p.size)) : 2;
  });
  useEffect(() => saveJSON(PRES_KEY, { size }), [size]);

  // Cronometrul predicii: pornește la deschidere; click pe el îl repornește.
  const [startedAt, setStartedAt] = useState(() => Date.now());
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const elapsed = Math.max(0, Math.floor((now - startedAt) / 1000));
  const clock = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}`;

  const last = slides.length - 1;
  const go = (d) => setIndex((i) => Math.min(last, Math.max(0, i + d)));
  const scrollRef = useRef(null);
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [index, mode]);

  function toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  }
  // La închidere iese și din ecranul complet.
  useEffect(() => () => {
    if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  }, []);

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Escape') {
        // Prima apăsare iese din ecran complet (o face browserul), a doua închide.
        if (document.fullscreenElement) return;
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key === '+' || e.key === '=') setSize((s) => Math.min(PRES_SIZES.length - 1, s + 1));
      else if (e.key === '-') setSize((s) => Math.max(0, s - 1));
      else if (e.key.toLowerCase() === 'f') toggleFullscreen();
      if (mode !== 'slides') return;
      if (['ArrowRight', 'PageDown', ' ', 'Enter'].includes(e.key)) {
        e.preventDefault();
        go(1);
      } else if (['ArrowLeft', 'PageUp', 'Backspace'].includes(e.key)) {
        e.preventDefault();
        go(-1);
      } else if (e.key === 'Home') setIndex(0);
      else if (e.key === 'End') setIndex(last);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, mode, last]);

  // Click în jumătatea dreaptă = înainte, în cea stângă = înapoi (ca la o telecomandă).
  function onSlideClick(e) {
    if (mode !== 'slides' || window.getSelection()?.toString()) return;
    const r = e.currentTarget.getBoundingClientRect();
    go(e.clientX - r.left > r.width / 3 ? 1 : -1);
  }

  const btn =
    'rounded-lg px-2.5 py-1.5 text-sm text-slate-600 transition hover:bg-slate-100 disabled:opacity-30 dark:text-slate-300 dark:hover:bg-slate-800';

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-white dark:bg-slate-950"
      role="dialog"
      aria-modal="true"
      aria-label={`Prezentare: ${sermon.title}`}
    >
      <div ref={scrollRef} onClick={onSlideClick} className={'flex-1 overflow-y-auto ' + (mode === 'slides' ? 'cursor-pointer select-text' : '')}>
        <div className="mx-auto flex min-h-full max-w-4xl flex-col px-6 py-10 sm:px-10">
          {/* Mărimea e pe container, ca titlurile (em) să scaleze odată cu ea.
              my-auto centrează slide-ul scurt; unul lung pornește de sus și se derulează. */}
          <div className={mode === 'slides' ? 'my-auto' : ''} style={{ fontSize: `${PRES_SIZES[size]}rem` }}>
            <Markdown
              text={mode === 'slides' ? slides[index] : sermon.body}
              className="font-serif leading-relaxed text-slate-900 dark:text-slate-100"
            />
          </div>
        </div>
      </div>

      {/* Bara de control: discretă până treci cu mouse-ul peste ea. */}
      <div
        className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 bg-white/90 px-3 py-2 opacity-60 transition hover:opacity-100 focus-within:opacity-100 dark:border-slate-800 dark:bg-slate-950/90"
        style={{ fontSize: '1rem' }}
      >
        <div className="flex items-center gap-1">
          {slides.length > 1 && (
            <>
              <button type="button" onClick={() => setMode('slides')} aria-pressed={mode === 'slides'} className={btn + (mode === 'slides' ? ' font-semibold text-slate-900 dark:text-white' : '')}>
                Slide-uri
              </button>
              <button type="button" onClick={() => setMode('scroll')} aria-pressed={mode === 'scroll'} className={btn + (mode === 'scroll' ? ' font-semibold text-slate-900 dark:text-white' : '')}>
                Tot textul
              </button>
            </>
          )}
        </div>

        {mode === 'slides' && (
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => go(-1)} disabled={index === 0} title="Înapoi (←)" aria-label="Slide-ul anterior" className={btn}>
              ‹
            </button>
            <span className="min-w-[4.5rem] text-center text-sm tabular-nums text-slate-500 dark:text-slate-400">
              {index + 1} / {slides.length}
            </span>
            <button type="button" onClick={() => go(1)} disabled={index === last} title="Înainte (→, Spațiu)" aria-label="Slide-ul următor" className={btn}>
              ›
            </button>
          </div>
        )}

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => {
              setStartedAt(Date.now());
              setNow(Date.now());
            }}
            title="Cronometru (click = de la zero)"
            className={btn + ' tabular-nums'}
          >
            ⏱ {clock}
          </button>
          <button type="button" onClick={() => setSize((s) => Math.max(0, s - 1))} disabled={size === 0} title="Text mai mic (−)" className={btn}>
            A−
          </button>
          <button type="button" onClick={() => setSize((s) => Math.min(PRES_SIZES.length - 1, s + 1))} disabled={size === PRES_SIZES.length - 1} title="Text mai mare (+)" className={btn}>
            A+
          </button>
          <button type="button" onClick={toggleFullscreen} title="Ecran complet (F)" aria-label="Ecran complet" className={btn}>
            <ExpandIcon />
          </button>
          <button type="button" onClick={onClose} title="Închide prezentarea (Esc)" aria-label="Închide prezentarea" className={btn}>
            <CloseIcon />
          </button>
        </div>
      </div>
    </div>
  );
}

/** Poziția verticală (px, în conținutul textarea-ului) a caracterului `pos`. */
function caretTop(ta, pos) {
  const cs = getComputedStyle(ta);
  const m = document.createElement('div');
  for (const p of ['fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'letterSpacing', 'paddingTop', 'paddingLeft', 'paddingRight', 'borderLeftWidth', 'borderRightWidth', 'tabSize']) {
    m.style[p] = cs[p];
  }
  Object.assign(m.style, {
    position: 'absolute',
    visibility: 'hidden',
    top: '0',
    left: '-9999px',
    boxSizing: 'border-box',
    width: ta.clientWidth + 'px',
    whiteSpace: 'pre-wrap',
    overflowWrap: 'break-word',
  });
  m.textContent = ta.value.slice(0, pos);
  const mark = document.createElement('span');
  mark.textContent = '.';
  m.appendChild(mark);
  document.body.appendChild(m);
  const top = mark.offsetTop;
  m.remove();
  return top;
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

function ExportItem({ onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="block w-full rounded-md px-2.5 py-1.5 text-left text-sm text-slate-700 transition hover:bg-slate-100 dark:text-slate-200 dark:hover:bg-slate-800"
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

function ListIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
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

function ExpandIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3M21 8V5a2 2 0 0 0-2-2h-3M3 16v3a2 2 0 0 0 2 2h3M16 21h3a2 2 0 0 0 2-2v-3" />
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

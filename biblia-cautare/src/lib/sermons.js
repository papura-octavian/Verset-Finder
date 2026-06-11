// Predicile utilizatorului (Batch 4) — contract de date + persistență.
// Documentele pot crește mult, deci persistăm în IndexedDB (cu rezervă pe
// localStorage unde IDB nu e disponibil, ex. unele browsere pe file://).
// UI-ul consumă DOAR funcțiile de aici — un viitor backend înlocuiește modulul.
//
// Forma unui document:
//   { id: string, title: string, body: string (markdown),
//     createdAt: number, updatedAt: number, order: number }
// Lista e ținută sortată după `order` (crescător); documentele noi intră primele.

import { useSyncExternalStore } from 'react';
import { loadJSON, saveJSON } from './storage.js';
import { norm } from './search.js';

const LS_KEY = 'biblia:sermons';
const DB_NAME = 'biblia';
const DB_STORE = 'sermons';

// Șabloanele oferite la crearea unui document nou.
export const TEMPLATES = [
  { id: 'blank', label: 'Document gol', body: '' },
  {
    id: 'sermon3',
    label: 'Predică în 3 puncte',
    body: [
      '# Titlul predicii', '',
      '> Textul de bază: ', '',
      '## Introducere', '', '- ', '',
      '## 1. Primul punct', '', '- ', '',
      '## 2. Al doilea punct', '', '- ', '',
      '## 3. Al treilea punct', '', '- ', '',
      '## Aplicare', '', '- ', '',
      '## Încheiere', '', '- ', '',
    ].join('\n'),
  },
  {
    id: 'study',
    label: 'Studiu biblic',
    body: [
      '# Tema studiului', '',
      '> Pasajul: ', '',
      '## Context', '', '- ', '',
      '## Observații', '', '- ', '',
      '## Interpretare', '', '- ', '',
      '## Aplicare', '', '- ', '',
    ].join('\n'),
  },
];

// --- Helperi comuni pentru export (.md / .docx / .pdf) ---

/** Markdown-ul complet al unui document: titlul devine H1 dacă body nu are deja unul. */
export function sermonMarkdown(sermon) {
  return sermon.body.trimStart().startsWith('# ')
    ? sermon.body
    : `# ${sermon.title}\n\n${sermon.body}`;
}

/** Numele de fișier (fără extensie) derivat din titlu: „Predica de duminică” → „predica-de-duminica”. */
export function sermonFileSlug(title) {
  return norm(title).replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '') || 'predica';
}

let state = { loaded: false, sermons: [] };
const listeners = new Set();

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

function setState(next) {
  state = next;
  listeners.forEach((fn) => fn());
}

// --- Persistență: IndexedDB cu rezervă pe localStorage ---

let dbPromise = null;
function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(DB_STORE)) {
          req.result.createObjectStore(DB_STORE, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

async function persistPut(sermon) {
  const db = await openDB();
  if (db) {
    try {
      db.transaction(DB_STORE, 'readwrite').objectStore(DB_STORE).put(sermon);
      return;
    } catch {
      /* cade pe localStorage */
    }
  }
  saveJSON(LS_KEY, state.sermons);
}

async function persistDelete(id) {
  const db = await openDB();
  if (db) {
    try {
      db.transaction(DB_STORE, 'readwrite').objectStore(DB_STORE).delete(id);
      return;
    } catch {
      /* cade pe localStorage */
    }
  }
  saveJSON(LS_KEY, state.sermons);
}

// Încărcarea inițială (o singură dată, leneș — la primul useSermons()).
let initStarted = false;
async function init() {
  if (initStarted) return;
  initStarted = true;
  const db = await openDB();
  let sermons;
  if (db) {
    sermons = await new Promise((resolve) => {
      try {
        const req = db.transaction(DB_STORE, 'readonly').objectStore(DB_STORE).getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  } else {
    sermons = loadJSON(LS_KEY, []);
  }
  sermons.sort((a, b) => a.order - b.order);
  setState({ loaded: true, sermons });
}

function genId() {
  return crypto.randomUUID?.() || 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

// --- API ---

/** Snapshot { loaded, sermons } (sortate după order); pornește încărcarea la prima folosire. */
export function useSermons() {
  init();
  return useSyncExternalStore(subscribe, () => state);
}

/** Creează un document (intră primul în listă) și îl întoarce. */
export function createSermon(title, body = '') {
  const now = Date.now();
  const minOrder = state.sermons.length ? state.sermons[0].order : 0;
  const sermon = {
    id: genId(),
    title: (title || '').trim() || 'Predică fără titlu',
    body,
    createdAt: now,
    updatedAt: now,
    order: minOrder - 1,
  };
  setState({ ...state, sermons: [sermon, ...state.sermons] });
  persistPut(sermon);
  return sermon;
}

// Salvarea pe disc e amânată puțin per document, ca tastarea să nu scrie
// în IndexedDB la fiecare literă; starea din memorie se actualizează imediat.
const saveTimers = new Map();
const SAVE_DELAY = 600;

export function updateSermon(id, patch) {
  let updated = null;
  const sermons = state.sermons.map((s) => {
    if (s.id !== id) return s;
    updated = { ...s, ...patch, updatedAt: Date.now() };
    return updated;
  });
  if (!updated) return;
  setState({ ...state, sermons });
  clearTimeout(saveTimers.get(id));
  saveTimers.set(id, setTimeout(() => {
    saveTimers.delete(id);
    persistPut(updated);
  }, SAVE_DELAY));
}

/** Scrie imediat pe disc orice salvare amânată (la părăsirea editorului). */
export function flushSermon(id) {
  if (!saveTimers.has(id)) return;
  clearTimeout(saveTimers.get(id));
  saveTimers.delete(id);
  const s = state.sermons.find((x) => x.id === id);
  if (s) persistPut(s);
}

export function deleteSermon(id) {
  clearTimeout(saveTimers.get(id));
  saveTimers.delete(id);
  setState({ ...state, sermons: state.sermons.filter((s) => s.id !== id) });
  persistDelete(id);
}

/** Mută documentul cu o poziție în sus (dir = -1) sau în jos (dir = +1). */
export function reorderSermon(id, dir) {
  const list = [...state.sermons];
  const i = list.findIndex((s) => s.id === id);
  const j = i + dir;
  if (i < 0 || j < 0 || j >= list.length) return;
  const a = { ...list[i], order: list[j].order };
  const b = { ...list[j], order: list[i].order };
  list[j] = a;
  list[i] = b;
  setState({ ...state, sermons: list });
  persistPut(a);
  persistPut(b);
}

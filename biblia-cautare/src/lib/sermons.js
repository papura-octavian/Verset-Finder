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

/** Durata estimată de vorbire (minute) la ~130 de cuvinte pe minut, ritmul obișnuit al unei predici. */
export function speakingMinutes(words) {
  return Math.max(1, Math.round(words / 130));
}

/** Numărul de cuvinte din markdown, fără marcaje. */
export function wordCount(body) {
  const plain = (body || '').replace(/[#>*_`-]+/g, ' ').trim();
  return plain ? plain.split(/\s+/).length : 0;
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

// Sincronizare între tab-uri: fiecare tab ține lista în memorie, deci fără asta
// un tab vechi nu vede predicile scrise în altul (și le poate rescrie).
const channel = typeof BroadcastChannel !== 'undefined' ? new BroadcastChannel('biblia:sermons') : null;

function broadcast(msg) {
  try {
    channel?.postMessage(msg);
  } catch {
    /* ignoră */
  }
}

if (channel) {
  channel.onmessage = ({ data }) => {
    if (!state.loaded || !data) return;
    if (data.type === 'put') {
      const others = state.sermons.filter((s) => s.id !== data.sermon.id);
      setState({ ...state, sermons: [...others, data.sermon].sort((a, b) => a.order - b.order) });
    } else if (data.type === 'delete') {
      setState({ ...state, sermons: state.sermons.filter((s) => s.id !== data.id) });
    }
  };
}

// --- Persistență: IndexedDB cu rezervă pe localStorage ---

let dbPromise = null;
// Conexiunea deschisă, pentru scrierile care nu pot aștepta un await (la închiderea paginii).
let dbHandle = null;
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
      req.onsuccess = () => {
        dbHandle = req.result;
        resolve(req.result);
      };
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbPromise;
}

async function persistPut(sermon) {
  broadcast({ type: 'put', sermon });
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
  broadcast({ type: 'delete', id });
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
// Promisiunea e păstrată, ca apelanții care o așteaptă (importul) să primească lista încărcată.
let initPromise = null;
function init() {
  if (!initPromise) initPromise = load();
  return initPromise;
}

async function load() {
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

  // Ce s-a scris în ultimele clipe dinaintea închiderii (vezi flushAll).
  const pending = loadJSON(PENDING_KEY, null);
  if (pending) {
    const byId = new Map(sermons.map((s) => [s.id, s]));
    for (const p of Object.values(pending)) {
      const cur = byId.get(p.id);
      if (!cur || (p.updatedAt || 0) > (cur.updatedAt || 0)) byId.set(p.id, p);
    }
    sermons = [...byId.values()];
  }

  sermons.sort((a, b) => a.order - b.order);
  setState({ loaded: true, sermons });

  if (pending) {
    Object.values(pending).forEach((p) => {
      const s = sermons.find((x) => x.id === p.id);
      if (s) persistPut(s);
    });
    try {
      localStorage.removeItem(PENDING_KEY);
    } catch {
      /* ignoră */
    }
  }
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

// Salvările amânate scrise sincron la închiderea paginii: o tranzacție IndexedDB
// pornită atunci poate fi abandonată de browser, localStorage nu. Se recuperează la load().
const PENDING_KEY = 'biblia:sermons:pending';

function flushAll() {
  const ids = [...saveTimers.keys()];
  if (!ids.length) return;
  const pending = loadJSON(PENDING_KEY, {});
  for (const id of ids) {
    clearTimeout(saveTimers.get(id));
    saveTimers.delete(id);
    const s = state.sermons.find((x) => x.id === id);
    if (!s) continue;
    pending[id] = s;
    broadcast({ type: 'put', sermon: s });
    try {
      dbHandle?.transaction(DB_STORE, 'readwrite').objectStore(DB_STORE).put(s);
    } catch {
      /* rămâne copia din localStorage */
    }
  }
  saveJSON(PENDING_KEY, pending);
}

// Închiderea tab-ului / trecerea aplicației în fundal (telefon) nu așteaptă
// întârzierea de salvare: ultimele cuvinte scrise s-ar pierde.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flushAll);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushAll();
  });
}

/** Șterge un document și îl întoarce, ca să poată fi readus cu restoreSermon. */
export function deleteSermon(id) {
  clearTimeout(saveTimers.get(id));
  saveTimers.delete(id);
  const removed = state.sermons.find((s) => s.id === id) || null;
  setState({ ...state, sermons: state.sermons.filter((s) => s.id !== id) });
  persistDelete(id);
  // O copie rămasă de la o ieșire anterioară în fundal nu trebuie să-l readucă la următoarea deschidere.
  const pending = loadJSON(PENDING_KEY, null);
  if (pending?.[id]) {
    delete pending[id];
    saveJSON(PENDING_KEY, pending);
  }
  return removed;
}

/** Readuce un document șters (butonul „Anulează"), pe locul lui din listă. */
export function restoreSermon(sermon) {
  if (!sermon || state.sermons.some((s) => s.id === sermon.id)) return;
  setState({ ...state, sermons: [...state.sermons, sermon].sort((a, b) => a.order - b.order) });
  persistPut(sermon);
}

/** O copie a documentului, pusă imediat sub original. */
export function duplicateSermon(id) {
  const i = state.sermons.findIndex((s) => s.id === id);
  if (i < 0) return null;
  const src = state.sermons[i];
  const next = state.sermons[i + 1];
  const now = Date.now();
  const copy = {
    ...src,
    id: genId(),
    title: `${src.title} (copie)`,
    createdAt: now,
    updatedAt: now,
    order: next ? (src.order + next.order) / 2 : src.order + 1,
  };
  const sermons = [...state.sermons];
  sermons.splice(i + 1, 0, copy);
  setState({ ...state, sermons });
  persistPut(copy);
  return copy;
}

/**
 * Importă documente dintr-un backup: cele noi se adaugă, iar la același id
 * rămâne versiunea modificată mai recent. Întoarce câte s-au adăugat/actualizat.
 */
export async function importSermons(list) {
  await init();
  let changed = 0;
  const byId = new Map(state.sermons.map((s) => [s.id, s]));
  for (const s of list || []) {
    if (!s || typeof s.id !== 'string' || typeof s.body !== 'string') continue;
    const cur = byId.get(s.id);
    if (cur && (cur.updatedAt || 0) >= (s.updatedAt || 0)) continue;
    const doc = {
      id: s.id,
      title: String(s.title || 'Predică fără titlu'),
      body: s.body,
      createdAt: Number(s.createdAt) || Date.now(),
      updatedAt: Number(s.updatedAt) || Date.now(),
      order: Number.isFinite(s.order) ? s.order : 0,
    };
    byId.set(doc.id, doc);
    persistPut(doc);
    changed++;
  }
  setState({ ...state, sermons: [...byId.values()].sort((a, b) => a.order - b.order) });
  return changed;
}

/** Toate documentele (pentru backup), cu salvările amânate scrise întâi. */
export async function allSermons() {
  await init();
  [...saveTimers.keys()].forEach(flushSermon);
  return state.sermons;
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

// Datele personale ale utilizatorului (semne de carte, evidențieri, note) —
// contractul de date din Batch 3. Persistența trece DOAR prin storage.js, iar
// UI-ul consumă DOAR funcțiile de aici: un viitor backend (.NET) înlocuiește
// modulul fără să atingă componentele.
//
// Cheia unui verset: "abbrev.capitol.verset" (ex. "jo.3.16") — independentă de
// traducere (abrevierile sunt comune), deci adnotările se văd în ambele versiuni.
//
// Forme stocate (localStorage):
//  - biblia:bookmarks  { [cheie]: { at: number, collection: string|null } }
//  - biblia:highlights { [cheie]: string }              // id din HIGHLIGHT_COLORS
//  - biblia:notes      { [cheie]: { text: string, at: number } }

import { useSyncExternalStore } from 'react';
import { loadJSON, saveJSON } from './storage.js';

// Paleta de evidențiere. Clasele Tailwind stau aici ca literali (sunt scanate la build).
export const HIGHLIGHT_COLORS = [
  { id: 'yellow', label: 'Galben',   dot: 'bg-yellow-400',  bg: 'bg-yellow-200/70 dark:bg-yellow-400/25' },
  { id: 'green',  label: 'Verde',    dot: 'bg-emerald-400', bg: 'bg-emerald-200/70 dark:bg-emerald-400/25' },
  { id: 'blue',   label: 'Albastru', dot: 'bg-sky-400',     bg: 'bg-sky-200/70 dark:bg-sky-400/25' },
  { id: 'pink',   label: 'Roz',      dot: 'bg-pink-400',    bg: 'bg-pink-200/70 dark:bg-pink-400/25' },
  { id: 'purple', label: 'Mov',      dot: 'bg-violet-400',  bg: 'bg-violet-200/70 dark:bg-violet-400/25' },
];

const COLOR_BG = Object.fromEntries(HIGHLIGHT_COLORS.map((c) => [c.id, c.bg]));

/** Clasele de fundal pentru un id de culoare ('' dacă nu există evidențiere). */
export function highlightBg(colorId) {
  return colorId ? COLOR_BG[colorId] || '' : '';
}

const KEYS = {
  bookmarks: 'biblia:bookmarks',
  highlights: 'biblia:highlights',
  notes: 'biblia:notes',
};

let state = {
  bookmarks: loadJSON(KEYS.bookmarks, {}),
  highlights: loadJSON(KEYS.highlights, {}),
  notes: loadJSON(KEYS.notes, {}),
};

const listeners = new Set();

function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

// Înlocuiește imutabil o felie, persistă și notifică abonații (useSyncExternalStore
// cere un snapshot nou ca referință la fiecare schimbare).
function update(part, value) {
  state = { ...state, [part]: value };
  saveJSON(KEYS[part], value);
  listeners.forEach((fn) => fn());
}

/** Cheia canonică a unui verset. */
export function verseKey(abbrev, chapter, verse) {
  return `${abbrev}.${chapter}.${verse}`;
}

/** Inversul lui verseKey. */
export function parseVerseKey(key) {
  const [abbrev, chapter, verse] = key.split('.');
  return { abbrev, chapter: Number(chapter), verse: Number(verse) };
}

/**
 * Snapshot-ul curent { bookmarks, highlights, notes }; componenta abonată se
 * re-randă la orice schimbare (din orice altă componentă).
 */
export function useAnnotations() {
  return useSyncExternalStore(subscribe, () => state);
}

// --- Semne de carte ---

export function toggleBookmark(key) {
  const next = { ...state.bookmarks };
  if (next[key]) delete next[key];
  else next[key] = { at: Date.now(), collection: null };
  update('bookmarks', next);
}

export function setBookmarkCollection(key, collection) {
  const cur = state.bookmarks[key];
  if (!cur) return;
  update('bookmarks', { ...state.bookmarks, [key]: { ...cur, collection: collection || null } });
}

/** Numele colecțiilor în uz (derivate din semnele de carte), sortate alfabetic. */
export function collectionNames(bookmarks) {
  const set = new Set();
  Object.values(bookmarks).forEach((b) => {
    if (b.collection) set.add(b.collection);
  });
  return [...set].sort((a, b) => a.localeCompare(b, 'ro'));
}

// --- Evidențieri ---

/** Setează culoarea unui verset; `null` o șterge. */
export function setHighlight(key, colorId) {
  const next = { ...state.highlights };
  if (colorId) next[key] = colorId;
  else delete next[key];
  update('highlights', next);
}

// --- Note ---

/** Salvează nota unui verset; text gol = ștergere. */
export function setNote(key, text) {
  const trimmed = (text || '').trim();
  const next = { ...state.notes };
  if (trimmed) next[key] = { text: trimmed, at: Date.now() };
  else delete next[key];
  update('notes', next);
}

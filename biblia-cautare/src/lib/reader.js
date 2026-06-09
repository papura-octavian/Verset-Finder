// Helperi pentru cititor: acces la text pe capitol + navigare carte↔capitol.
// Lucrează direct pe `translation.data` (array de cărți { abbrev, name, chapters }),
// nu pe indexul de căutare.

import { bookList } from '../data/books.js';

/** Întoarce obiectul-carte din date pentru o abreviere, sau null. */
export function getBook(translation, abbrev) {
  if (!translation || !abbrev) return null;
  return translation.data.find((b) => b.abbrev === abbrev) || null;
}

/** Numărul de capitole dintr-o carte (0 dacă nu există). */
export function chapterCount(translation, abbrev) {
  const book = getBook(translation, abbrev);
  return book ? book.chapters.length : 0;
}

/**
 * Versetele unui capitol ca array de șiruri (1-based pentru capitol), sau null.
 */
export function getChapterVerses(translation, abbrev, chapter) {
  const book = getBook(translation, abbrev);
  if (!book) return null;
  const verses = book.chapters[chapter - 1];
  return Array.isArray(verses) ? verses : null;
}

/** Numele cărții din maparea traducerii (sau abrevierea ca rezervă). */
export function bookName(translation, abbrev) {
  const meta = translation?.books?.[abbrev];
  return meta ? meta.name : abbrev;
}

/**
 * Capitolul anterior, traversând granițele de carte în ordine canonică.
 * @returns {{ abbrev, chapter }|null} null dacă suntem la prima poziție din Biblie.
 */
export function prevChapter(translation, abbrev, chapter) {
  if (chapter > 1) return { abbrev, chapter: chapter - 1 };
  const list = bookList(translation.books);
  const i = list.findIndex((b) => b.abbrev === abbrev);
  if (i <= 0) return null; // prima carte, primul capitol
  const prev = list[i - 1];
  return { abbrev: prev.abbrev, chapter: chapterCount(translation, prev.abbrev) };
}

/**
 * Capitolul următor, traversând granițele de carte în ordine canonică.
 * @returns {{ abbrev, chapter }|null} null dacă suntem la ultima poziție din Biblie.
 */
export function nextChapter(translation, abbrev, chapter) {
  const total = chapterCount(translation, abbrev);
  if (chapter < total) return { abbrev, chapter: chapter + 1 };
  const list = bookList(translation.books);
  const i = list.findIndex((b) => b.abbrev === abbrev);
  if (i === -1 || i >= list.length - 1) return null; // ultima carte, ultimul capitol
  const next = list[i + 1];
  return { abbrev: next.abbrev, chapter: 1 };
}

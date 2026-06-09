import { norm } from './search.js';

/**
 * Aplatizează o traducere într-un index plat, cu `norm` precalculat per verset.
 * Folosește numele de cărți ale traducerii (RO pentru Cornilescu, EN pentru KJV).
 * Rezultat: [{ abbrev, book, chapter, verse, ref, text, norm }, ...] (~31.000 versete).
 */
export function buildIndex(translation) {
  const { data, books } = translation;
  const index = [];
  for (const book of data) {
    const meta = books[book.abbrev];
    const name = meta ? meta.name : book.abbrev;
    const chapters = book.chapters || [];
    for (let c = 0; c < chapters.length; c++) {
      const verses = chapters[c];
      for (let v = 0; v < verses.length; v++) {
        const text = verses[v];
        index.push({
          abbrev: book.abbrev,
          testament: meta ? meta.testament : undefined,
          book: name,
          chapter: c + 1,
          verse: v + 1,
          ref: `${name} ${c + 1}:${v + 1}`,
          text,
          norm: norm(text),
        });
      }
    }
  }
  return index;
}

/** Număr de capitole per carte (abbrev -> n), pentru selectorul de capitole. */
export function chapterCounts(translation) {
  return Object.fromEntries(translation.data.map((b) => [b.abbrev, b.chapters.length]));
}

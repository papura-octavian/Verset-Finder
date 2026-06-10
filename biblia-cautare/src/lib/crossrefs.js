// Trimiterile biblice (cross-references) — date de la openbible.info (CC-BY),
// derivate din Treasury of Scripture Knowledge; convertite cu
// scripts/buildCrossRefs.mjs în formatul compact:
//   { "jo.3.16": "rm.5.8 1jo.4.9-10 ..." }  (top 10 per verset, după voturi)

import data from '../data/crossrefs.json';
import { bookName } from './reader.js';

const TARGET_RE = /^(.+)\.(\d+)\.(\d+)(?:-(\d+))?$/;

/**
 * Trimiterile unui verset, în ordinea relevanței.
 * @returns {Array<{abbrev, chapter, verse, verseEnd|null}>} [] dacă nu există.
 */
export function getCrossRefs(abbrev, chapter, verse) {
  const packed = data[`${abbrev}.${chapter}.${verse}`];
  if (!packed) return [];
  const out = [];
  for (const t of packed.split(' ')) {
    const m = t.match(TARGET_RE);
    if (!m) continue;
    out.push({
      abbrev: m[1],
      chapter: Number(m[2]),
      verse: Number(m[3]),
      verseEnd: m[4] ? Number(m[4]) : null,
    });
  }
  return out;
}

/** Eticheta afișabilă a unei trimiteri: „Romani 5:8", „1 Ioan 4:9-10". */
export function crossRefLabel(translation, ref) {
  return (
    `${bookName(translation, ref.abbrev)} ${ref.chapter}:${ref.verse}` +
    (ref.verseEnd ? `-${ref.verseEnd}` : '')
  );
}

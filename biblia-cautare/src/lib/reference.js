// Căutare după REFERINȚĂ (prefix „@"): @isaia 30:1, @isaia 1:1-10, @isaia 1.
// Modul pur (string + date → obiecte), fără UI. Rezultatele au aceeași formă ca cele
// de la căutarea pe cuvinte, ca să se randeze prin ResultList/VerseCard fără adaptări.

import { norm } from './search.js';
import { TRANSLATION_LIST } from './translations.js';
import { getChapterVerses, bookName } from './reader.js';

// Normalizare „strânsă": fără diacritice ȘI fără spații, ca „1ioan" == „1 Ioan".
function squash(s) {
  return norm(s).replace(/\s+/g, '');
}

/**
 * Rezolvă un nume/abreviere de carte la abrevierea canonică.
 * Potrivire: exact (nume sau abreviere) → apoi prefix unic pe nume. Caută în numele
 * traducerii active întâi, apoi în ale celorlalte (abrevierile sunt comune), ca să
 * meargă și „@john 3:16" pe traducerea română. Ambiguu (ex. „io") → null.
 * @returns {string|null} abrevierea (ex. „jo") sau null dacă negăsit/ambiguu.
 */
export function resolveBook(token, translation) {
  const t = squash(token);
  if (!t) return null;

  // Listă de candidați {abbrev, sName}, traducerea activă prima (prioritate).
  const maps = [
    translation.books,
    ...TRANSLATION_LIST.filter((x) => x.id !== translation.id).map((x) => x.books),
  ];
  const entries = [];
  for (const m of maps) {
    for (const abbrev of Object.keys(m)) {
      entries.push({ abbrev, sName: squash(m[abbrev].name) });
    }
  }

  // 1) Potrivire exactă pe nume sau abreviere.
  for (const e of entries) {
    if (e.sName === t || squash(e.abbrev) === t) return e.abbrev;
  }

  // 2) Prefix pe nume — acceptat doar dacă duce la o singură carte.
  const pref = new Set();
  for (const e of entries) {
    if (e.sName.startsWith(t)) pref.add(e.abbrev);
  }
  return pref.size === 1 ? [...pref][0] : null;
}

/**
 * Parsează o referință (cu sau fără „@").
 * Capitolul e obligatoriu; versetul/­intervalul sunt opționale.
 * @returns {{abbrev,chapter,verseStart,verseEnd}|{error:string}|null}
 */
export function parseReference(input, translation) {
  if (!input) return null;
  let s = input.trim();
  if (s.startsWith('@')) s = s.slice(1).trim();
  if (!s) return { error: 'empty' };

  // Numele cărții = totul înainte de coada numerică „cap[:vers[-vers]]".
  // Separatorul capitol/verset poate fi „:", „." sau „," (Ioan 3:16 / 3.16 / 3,16),
  // iar spațiul dintre carte și capitol e opțional („ioan3:16").
  const m = s.match(/^(.*?[^\d\s].*?)\s*(\d+)(?:\s*[:.,]\s*(\d+)(?:\s*[-–]\s*(\d+))?)?\.?$/);
  if (!m) return { error: 'format' };

  const abbrev = resolveBook(m[1], translation);
  if (!abbrev) return { error: 'book' };

  let chapter = parseInt(m[2], 10);
  let verseStart = m[3] != null ? parseInt(m[3], 10) : null;
  let verseEnd = m[4] != null ? parseInt(m[4], 10) : null;
  // Cărțile cu un singur capitol (Obadia, Filimon, 2-3 Ioan, Iuda) se citează
  // de obicei doar cu versetul: „Iuda 3" = Iuda 1:3.
  if (verseStart == null && chapter > 1 && translation?.data?.find((b) => b.abbrev === abbrev)?.chapters.length === 1) {
    verseStart = chapter;
    chapter = 1;
  }
  if (verseStart != null && verseEnd != null && verseEnd < verseStart) {
    [verseStart, verseEnd] = [verseEnd, verseStart];
  }
  return { abbrev, chapter, verseStart, verseEnd };
}

/**
 * Recunoaște o referință tastată fără „@" („ioan 3:16", „Ps 23", „1 Ioan 1,9").
 * Strict, ca să nu fure căutările obișnuite: doar „carte + număr", cu o carte
 * care există și un capitol care există. Altfel null (rămâne căutare de cuvinte).
 */
export function detectReference(input, translation) {
  const s = (input || '').trim();
  if (s.startsWith('@') || !/^(\d\s*)?[\p{L}][\p{L}.\s]*\s*\d+(\s*[:.,]\s*\d+(\s*[-–]\s*\d+)?)?\.?$/u.test(s)) return null;
  const ref = parseReference(s, translation);
  if (!ref || ref.error) return null;
  return referenceVerses(translation, ref).length ? ref : null;
}

/**
 * Versetele unei referințe, în forma rezultatelor de căutare
 * ({ abbrev, book, chapter, verse, ref, text, norm, matches: [] }).
 * Întoarce [] dacă capitolul/intervalul nu există.
 */
export function referenceVerses(translation, ref) {
  const { abbrev, chapter, verseStart, verseEnd } = ref;
  const all = getChapterVerses(translation, abbrev, chapter);
  if (!all) return [];

  const name = bookName(translation, abbrev);
  let from = 1;
  let to = all.length;
  if (verseStart != null) {
    from = verseStart;
    to = verseEnd != null ? verseEnd : verseStart;
  }
  from = Math.max(1, from);
  to = Math.min(all.length, to);

  const out = [];
  for (let v = from; v <= to; v++) {
    const text = all[v - 1];
    if (text == null) continue;
    out.push({
      abbrev,
      book: name,
      chapter,
      verse: v,
      ref: `${name} ${chapter}:${v}`,
      text,
      norm: norm(text),
      matches: [],
    });
  }
  return out;
}

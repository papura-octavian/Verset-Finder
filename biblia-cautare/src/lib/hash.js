// Schema URL cu hash — UN SINGUR loc de parse/format pentru întreaga aplicație.
//
// Două forme:
//   #<trad>/<carte>.<capitol>[.<verset>]   → cititor (ex. #vdc/jo.3.16, #vdc/ps.23)
//   #<trad>/q=<căutare>                     → căutare reluată din link (ex. #vdc/q=credinta)
//
// Notă: abrevierile de cărți pot conține cifre (1sm, 2co, 1jo), dar NICIODATĂ punct,
// deci putem împărți partea de referință după „." fără ambiguitate:
//   „1sm.3.16" → ['1sm', '3', '16'].
//
// Acest modul e PUR (string ↔ obiect), fără dependențe. Validarea semantică
// (traducerea există? cartea există? capitolul e în interval?) se face în App.

/**
 * Parsează un hash de URL într-o stare structurată.
 * @param {string} raw - ex. „#vdc/jo.3.16" sau „vdc/q=credinta" (cu sau fără „#").
 * @returns {null
 *   | { type: 'reader', translation: string, abbrev: string, chapter: number, verse: number|null }
 *   | { type: 'search', translation: string, query: string }}
 */
export function parseHash(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const h = raw.startsWith('#') ? raw.slice(1) : raw;
  if (!h) return null;

  const slash = h.indexOf('/');
  if (slash === -1) return null;

  const translation = h.slice(0, slash);
  const rest = h.slice(slash + 1);
  if (!translation || !rest) return null;

  // Formă căutare: #<trad>/q=<encoded>
  if (rest.startsWith('q=')) {
    const enc = rest.slice(2);
    let query;
    try {
      query = decodeURIComponent(enc);
    } catch {
      query = enc; // hash malformat: folosește bruta
    }
    if (!query.trim()) return null;
    return { type: 'search', translation, query };
  }

  // Formă cititor: <carte>.<capitol>[.<verset>]
  const parts = rest.split('.');
  if (parts.length < 2) return null;

  const abbrev = parts[0];
  const chapter = parseInt(parts[1], 10);
  if (!abbrev || !Number.isInteger(chapter) || chapter < 1) return null;

  let verse = null;
  if (parts.length >= 3 && parts[2] !== '') {
    verse = parseInt(parts[2], 10);
    if (!Number.isInteger(verse) || verse < 1) return null;
  }

  return { type: 'reader', translation, abbrev, chapter, verse };
}

/**
 * Construiește un hash de cititor.
 * @param {string} translation - id-ul traducerii (ex. „vdc")
 * @param {string} abbrev      - abrevierea cărții (ex. „jo")
 * @param {number} chapter     - capitolul (1-based)
 * @param {number|null} [verse]- versetul (1-based), opțional
 * @returns {string} ex. „#vdc/jo.3.16" sau „#vdc/jo.3"
 */
export function formatReader(translation, abbrev, chapter, verse = null) {
  let h = `#${translation}/${abbrev}.${chapter}`;
  if (verse != null) h += `.${verse}`;
  return h;
}

/**
 * Construiește un hash de căutare.
 * @param {string} translation - id-ul traducerii
 * @param {string} query       - textul căutat
 * @returns {string} ex. „#vdc/q=credinta"
 */
export function formatSearch(translation, query) {
  return `#${translation}/q=${encodeURIComponent(query)}`;
}

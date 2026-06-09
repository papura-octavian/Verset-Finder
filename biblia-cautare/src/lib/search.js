// Logica de căutare: normalizare diacritice (mereu activă) + filtrare cu toggle-uri.

/**
 * Normalizare insensibilă la diacritice.
 * 1) lowercase
 * 2) NFD + ștergerea semnelor diacritice combinate (acoperă ă, â, î, ș/ş, ț/ţ —
 *    inclusiv formele vechi cu sedilă, fiindcă sedila combinată U+0327 e în interval)
 * 3) mapare explicită 1:1 ca plasă de siguranță pentru caractere precompuse
 *    care nu s-ar descompune.
 *
 * IMPORTANT: maparea e 1 caracter -> 1 caracter, deci LUNGIMEA se păstrează.
 * Astfel offset-urile calculate pe textul normalizat se folosesc direct pentru
 * highlight pe textul ORIGINAL.
 */
export function norm(s) {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // semne diacritice combinate
    .replace(/ă/g, 'a')
    .replace(/â/g, 'a')
    .replace(/î/g, 'i')
    .replace(/[șş]/g, 's')
    .replace(/[țţ]/g, 't');
}

function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Parsează o specificație de capitole („1-3, 5, 8-10") într-un Set de numere.
 * Întoarce null dacă e gol/invalid (= toate capitolele). `max` limitează valorile.
 */
export function parseChapterSpec(spec, max = Infinity) {
  if (!spec || !spec.trim()) return null;
  const set = new Set();
  for (const part of spec.split(',')) {
    const p = part.trim();
    if (!p) continue;
    const range = p.match(/^(\d+)\s*-\s*(\d+)$/);
    if (range) {
      let a = +range[1];
      let b = +range[2];
      if (a > b) [a, b] = [b, a];
      for (let i = a; i <= b; i++) if (i >= 1 && i <= max) set.add(i);
    } else if (/^\d+$/.test(p)) {
      const n = +p;
      if (n >= 1 && n <= max) set.add(n);
    }
  }
  return set.size ? set : null;
}

/**
 * Găsește toate aparițiile lui `needle` în `hay` (ambele deja normalizate).
 * Întoarce offset-uri { start, end } valabile și pe textul original (norm e 1:1).
 */
function findMatches(hay, needle, wholeWord) {
  const matches = [];
  if (!needle) return matches;

  if (wholeWord) {
    // \b funcționează corect fiindcă textul normalizat e ASCII (fără diacritice).
    const re = new RegExp('\\b' + escapeRegex(needle) + '\\b', 'g');
    let m;
    while ((m = re.exec(hay)) !== null) {
      matches.push({ start: m.index, end: m.index + m[0].length });
      if (m.index === re.lastIndex) re.lastIndex++; // evită bucla infinită
    }
  } else {
    let from = 0;
    let idx;
    while ((idx = hay.indexOf(needle, from)) !== -1) {
      matches.push({ start: idx, end: idx + needle.length });
      from = idx + needle.length; // apariții ne-suprapuse
    }
  }
  return matches;
}

/** Unește intervalele de highlight care se suprapun/ating, ca să nu avem <mark> imbricate. */
function mergeMatches(matches) {
  if (matches.length <= 1) return matches;
  const sorted = [...matches].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged = [{ ...sorted[0] }];
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1];
    const cur = sorted[i];
    if (cur.start <= last.end) {
      last.end = Math.max(last.end, cur.end);
    } else {
      merged.push({ ...cur });
    }
  }
  return merged;
}

/**
 * Caută în index și întoarce versetele găsite (în ordinea din index = canonică).
 * @param {Array} index  - [{ abbrev, book, chapter, verse, ref, text, norm }]
 * @param {string} query - textul introdus de utilizator
 * @param {object} opts  - { wholeWord, exactPhrase }
 * @returns {Array} [{ ...verse, matches: [{start,end}] }]
 */
export function search(index, query, { wholeWord = false, exactPhrase = false, book = 'all', chapters = null, testament = 'all' } = {}) {
  const nq = norm(query).trim();
  if (!nq) return [];

  const onlyBook = book && book !== 'all' ? book : null;
  // Filtru rapid VT/NT: se aplică doar când nu e selectată o carte anume.
  const onlyTestament = !onlyBook && testament && testament !== 'all' ? testament : null;
  // Filtrul pe capitole are sens doar când e selectată o carte anume.
  const chapterSet = onlyBook && chapters instanceof Set && chapters.size ? chapters : null;
  const results = [];

  if (exactPhrase) {
    // Tot textul introdus, ca un singur șir continuu (păstrând spațiile interioare).
    const needle = nq;
    for (const v of index) {
      if (onlyBook && v.abbrev !== onlyBook) continue;
      if (onlyTestament && v.testament !== onlyTestament) continue;
      if (chapterSet && !chapterSet.has(v.chapter)) continue;
      const matches = findMatches(v.norm, needle, wholeWord);
      if (matches.length) results.push({ ...v, matches });
    }
  } else {
    // Împarte în token-uri pe spații; cere ca FIECARE token să apară (AND, orice ordine).
    const tokens = nq.split(/\s+/).filter(Boolean);
    for (const v of index) {
      if (onlyBook && v.abbrev !== onlyBook) continue;
      if (onlyTestament && v.testament !== onlyTestament) continue;
      if (chapterSet && !chapterSet.has(v.chapter)) continue;
      let allFound = true;
      const all = [];
      for (const token of tokens) {
        const m = findMatches(v.norm, token, wholeWord);
        if (!m.length) {
          allFound = false;
          break;
        }
        all.push(...m);
      }
      if (allFound) {
        results.push({ ...v, matches: mergeMatches(all) });
      }
    }
  }

  return results;
}

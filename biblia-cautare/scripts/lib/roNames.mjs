// Deducerea numelor românești (Cornilescu) pentru nume englezești din setul Theographic:
// în versetele unde apare persoana sau locul, căutăm cuvântul cu majusculă din RCCV care
// seamănă cel mai mult cu numele englezesc și apare în cele mai multe dintre ele.
// Folosit de buildPeople.mjs și buildPlaces.mjs.

import { readFileSync } from 'node:fs';

export const OSIS = {
  Gen: 'gn', Exod: 'ex', Lev: 'lv', Num: 'nm', Deut: 'dt', Josh: 'js',
  Judg: 'jud', Ruth: 'rt', '1Sam': '1sm', '2Sam': '2sm', '1Kgs': '1kgs',
  '2Kgs': '2kgs', '1Chr': '1ch', '2Chr': '2ch', Ezra: 'ezr', Neh: 'ne',
  Esth: 'et', Job: 'job', Ps: 'ps', Prov: 'prv', Eccl: 'ec', Song: 'so',
  Isa: 'is', Jer: 'jr', Lam: 'lm', Ezek: 'ez', Dan: 'dn', Hos: 'ho',
  Joel: 'jl', Amos: 'am', Obad: 'ob', Jonah: 'jn', Mic: 'mi', Nah: 'na',
  Hab: 'hk', Zeph: 'zp', Hag: 'hg', Zech: 'zc', Mal: 'ml',
  Matt: 'mt', Mark: 'mk', Luke: 'lk', John: 'jo', Acts: 'act', Rom: 'rm',
  '1Cor': '1co', '2Cor': '2co', Gal: 'gl', Eph: 'eph', Phil: 'ph', Col: 'cl',
  '1Thess': '1ts', '2Thess': '2ts', '1Tim': '1tm', '2Tim': '2tm', Titus: 'tt',
  Phlm: 'phm', Heb: 'hb', Jas: 'jm', '1Pet': '1pe', '2Pet': '2pe',
  '1John': '1jo', '2John': '2jo', '3John': '3jo', Jude: 'jd', Rev: 're',
};

// Cuvinte cu majusculă care nu sunt nume (Domnul, pronumele pentru Dumnezeu, începuturi de frază…).
const STOP = new Set(
  `domnul domnului doamne dumnezeu dumnezeul dumnezeului dumnezeule atotputernicul
   cel cea cei el ea ei ele eu tu noi voi lui sau sa mea meu tau ta tale tai mei mele lor
   duhul duhului fiul fiului tatal tatalui hristos hristosul hristosului mantuitorul
   iata atunci si dar caci apoi cand dupa acum aceasta acesta asa daca de din in la pe pentru
   sa nu ce cine cum unde iar ori fiindca fiecare toti toate`
    .split(/\s+/)
    .filter(Boolean)
);

export const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Formă „fonetică" comună pentru engleză și română (Jacob/Iacov → iacob, Joseph/Iosif).
function phon(s) {
  return strip(s)
    .replace(/[^a-z]/g, '')
    .replace(/ph/g, 'f')
    .replace(/th/g, 't')
    .replace(/sh/g, 's')
    .replace(/ch/g, 'c')
    .replace(/[kq]/g, 'c')
    .replace(/[jy]/g, 'i')
    .replace(/w/g, 'v')
    .replace(/v/g, 'b')
    .replace(/z/g, 's')
    .replace(/h/g, '')
    .replace(/(.)\1+/g, '$1');
}

function lev(a, b) {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i]);
  for (let j = 1; j <= b.length; j++) d[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return d[a.length][b.length];
}

export function similarity(en, ro) {
  const a = phon(en);
  const b = phon(ro);
  if (!a || !b) return 0;
  return 1 - lev(a, b) / Math.max(a.length, b.length);
}

/** Textele RCCV pe chei „gn.1.1" + vocabularul de cuvinte cu majusculă. */
export function loadRccv(path) {
  const rccv = JSON.parse(readFileSync(path, 'utf8'));
  const text = new Map();
  for (const book of rccv) {
    book.chapters.forEach((vs, c) => vs.forEach((t, v) => text.set(`${book.abbrev}.${c + 1}.${v + 1}`, t)));
  }
  const vocabulary = new Set();
  for (const t of text.values()) for (const m of t.matchAll(/\p{Lu}[\p{L}-]*/gu)) vocabulary.add(m[0]);
  return { text, vocabulary };
}

/**
 * @param {{ text: Map<string,string>, vocabulary: Set<string> }} rccv
 * @param {{ articles?: boolean }} opts articles: numele de locuri apar și articulate
 *   („Egiptul", „Ierusalimului", „Samariei"); le aducem la forma de bază înainte de vot.
 */
export function createMatcher({ text, vocabulary }, { articles = false } = {}) {
  const cache = new Map();
  function candidates(key) {
    if (cache.has(key)) return cache.get(key);
    const words = new Set();
    for (const m of (text.get(key) || '').matchAll(/\p{Lu}[\p{L}’'-]*/gu)) {
      const w = m[0].replace(/[’'-]+$/, '');
      if (w.length >= 2 && !STOP.has(strip(w))) words.add(articles ? baseForm(w) : w);
    }
    cache.set(key, words);
    return words;
  }

  function baseForm(w) {
    for (const [re, to] of [
      [/ului$/, ''],
      [/eii$/, 'eea'],
      [/iei$/, 'ia'],
      [/ul$/, ''],
      [/lui$/, ''],
      [/ei$/, 'a'],
    ]) {
      const alt = w.replace(re, to);
      if (alt !== w && alt.length >= 2 && vocabulary.has(alt)) return alt;
    }
    return w;
  }

  /** Numele românesc pentru `name` (engleză), din versetele `keys`, sau null dacă nu e sigur. */
  return function romanianName(name, keys) {
    const scores = new Map();
    const n = Math.min(keys.length, 400);
    for (const key of keys.slice(0, n)) {
      for (const w of candidates(key)) {
        const s = scores.get(w) || { hits: 0, sim: similarity(name, w) };
        s.hits++;
        scores.set(w, s);
      }
    }
    let best = null;
    for (const [w, s] of scores) {
      const ratio = s.hits / n;
      // Asemănarea contează cel mai mult; frecvența prinde numele foarte diferite (Elijah → Ilie).
      const score = s.sim * 2 + ratio + (ratio > 0.6 ? 0.5 : 0);
      if (!best || score > best.score) best = { w, score, sim: s.sim, ratio };
    }
    if (!best) return null;
    const sure = best.sim >= 0.6 || (best.sim >= 0.34 && best.ratio >= 0.5) || (best.ratio >= 0.8 && n >= 4);
    return sure ? best.w : null;
  };
}

/** „Gen.1.1" → „gn.1.1" (null pentru cărți necunoscute). */
export function osisToKey(osis) {
  const m = osis.match(/^(.+)\.(\d+)\.(\d+)$/);
  return m && OSIS[m[1]] ? `${OSIS[m[1]]}.${m[2]}.${m[3]}` : null;
}

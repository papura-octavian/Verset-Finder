// Construiește baza de personaje biblice (pagina „Personaje") din setul Theographic.
//
// Sursa (descărcată manual, NU intră în git), licență CC BY-SA 4.0:
//   https://github.com/robertrouse/theographic-bible-metadata (json/people.json, json/verses.json)
//   → <repo>/data-src/theographic/{people,verses}.json
//
// Rulare (din biblia-cautare/):  node scripts/buildPeople.mjs
// Ieșire: src/data/people.json — listă compactă:
//   { id, slug, en, ro, g: 'M'|'F', f, m: id|null (tată/mamă), sp, sib, ch: [id],
//     v: "gn.1.27 gn.2.19 ..." (versetele în ordine canonică), y: [an naștere, an moarte]|null,
//     dict: textul din dicționarul Easton (engleză) | undefined }
//
// Numele românesc (Cornilescu) nu există în sursă: îl deducem din RCCV. Pentru fiecare
// persoană luăm versetele în care apare și căutăm, printre cuvintele cu majusculă din
// textul românesc, pe cel care seamănă cel mai bine cu numele englezesc și apare în cele
// mai multe dintre aceste versete (Abraham → Avraam, Jacob → Iacov, Elijah → Ilie).
// Unde nu găsim un candidat sigur rămâne numele englezesc. OVERRIDES corectează excepțiile.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '..', '..', 'data-src', 'theographic');
const RCCV = join(here, '..', 'src', 'data', 'rccv.json');
const OUTPUT = join(here, '..', 'src', 'data', 'people.json');

const OSIS = {
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

// Nume pe care potrivirea automată nu le poate ghici (alt cuvânt, sau sunt peste tot).
// Cheia: titlul afișat din sursă (displayTitle) sau, mai general, numele.
const OVERRIDES = {
  God: 'Dumnezeu',
  Jesus: 'Isus Hristos',
  'Jesus Christ': 'Isus Hristos',
  'Holy Spirit': 'Duhul Sfânt',
  'Simon Peter': 'Petru',
  'John Mark': 'Marcu',
  'Jacob (Israel)': 'Iacov (Israel)',
};

// Cuvinte cu majusculă care nu sunt nume de persoane (Domnul, pronumele pentru Dumnezeu…).
const STOP = new Set(
  `domnul domnului doamne dumnezeu dumnezeul dumnezeului dumnezeule atotputernicul
   cel cea cei el ea ei ele eu tu noi voi lui sau sa mea meu tau ta tale tai mei mele lor
   duhul duhului fiul fiului tatal tatalui hristos hristosul hristosului mantuitorul
   iata atunci si dar caci apoi cand dupa acum aceasta acesta asa daca de din in la pe pentru
   sa nu ce cine cum unde iar ori fiindca fiecare toti toate`
    .split(/\s+/)
    .filter(Boolean)
);

const strip = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Formă „fonetică" comună pentru engleză și română, ca să se poată compara numele:
// Jacob/Iacov → iacob, Joseph/Iosif → iosef/iosif, Hezekiah/Ezechia, Elisha/Elisei.
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

function similarity(en, ro) {
  const a = phon(en);
  const b = phon(ro);
  if (!a || !b) return 0;
  return 1 - lev(a, b) / Math.max(a.length, b.length);
}

// --- încărcare ---
const people = JSON.parse(readFileSync(join(SRC, 'people.json'), 'utf8'));
const verses = JSON.parse(readFileSync(join(SRC, 'verses.json'), 'utf8'));
const rccv = JSON.parse(readFileSync(RCCV, 'utf8'));

const rccvText = new Map();
for (const book of rccv) {
  book.chapters.forEach((vs, c) => vs.forEach((t, v) => rccvText.set(`${book.abbrev}.${c + 1}.${v + 1}`, t)));
}

const verseKey = new Map(); // id înregistrare → "gn.1.27"
const order = new Map(); // "gn.1.27" → poziția canonică
verses.forEach((r, i) => {
  const m = r.fields.osisRef.match(/^(.+)\.(\d+)\.(\d+)$/);
  if (!m || !OSIS[m[1]]) return;
  const key = `${OSIS[m[1]]}.${m[2]}.${m[3]}`;
  verseKey.set(r.id, key);
  order.set(key, i);
});

// Cuvintele cu majusculă din fiecare verset românesc (candidații pentru nume).
const candCache = new Map();
function candidates(key) {
  if (candCache.has(key)) return candCache.get(key);
  const text = rccvText.get(key) || '';
  const words = new Set();
  for (const m of text.matchAll(/\p{Lu}[\p{L}’'-]*/gu)) {
    const w = m[0].replace(/[’'-]+$/, '');
    if (w.length >= 2 && !STOP.has(strip(w))) words.add(w);
  }
  candCache.set(key, words);
  return words;
}

function romanianName(name, keys, title) {
  if (OVERRIDES[title]) return { ro: OVERRIDES[title], sure: true };
  if (OVERRIDES[name]) return { ro: OVERRIDES[name], sure: true };
  const scores = new Map();
  const n = Math.min(keys.length, 400); // destul pentru vot, și rapid
  for (const key of keys.slice(0, n)) {
    for (const w of candidates(key)) {
      const sim = similarity(name, w);
      const s = scores.get(w) || { hits: 0, sim };
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
  if (!best) return { ro: null, sure: false };
  const sure = best.sim >= 0.6 || (best.sim >= 0.34 && best.ratio >= 0.5) || (best.ratio >= 0.8 && n >= 4);
  return sure ? { ro: best.w, sure: true, sim: best.sim } : { ro: null, sure: false };
}

// Numele de femei apar des la genitiv-dativ („Mariei", „Rebecii"): dacă forma de
// nominativ („Maria", „Rebeca") există undeva în RCCV, o preferăm.
const vocabulary = new Set();
for (const t of rccvText.values()) for (const m of t.matchAll(/\p{Lu}[\p{L}-]*/gu)) vocabulary.add(m[0]);
function nominative(w) {
  for (const [re, to] of [[/ei$/, 'a'], [/ii$/, 'a'], [/iei$/, 'ia'], [/ei$/, 'e']]) {
    const alt = w.replace(re, to);
    if (alt !== w && vocabulary.has(alt)) return alt;
  }
  return w;
}

// --- conversie ---
const idOf = new Map(people.map((p) => [p.id, p.fields.personID]));
const rel = (list) => (list || []).map((r) => idOf.get(r)).filter((x) => x != null);

let guessed = 0;
const out = [];
for (const p of people) {
  const f = p.fields;
  const keys = [...new Set((f.verses || []).map((r) => verseKey.get(r)).filter(Boolean))].sort((a, b) => order.get(a) - order.get(b));
  let { ro } = romanianName(f.name, keys, f.displayTitle);
  if (ro && f.gender === 'Female') ro = nominative(ro);
  if (ro) guessed++;
  const dict = (f.dictText || []).join('\n').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').trim();
  const y = f.birthYear || f.deathYear ? [f.birthYear ? Number(f.birthYear) : null, f.deathYear ? Number(f.deathYear) : null] : null;
  out.push({
    id: f.personID,
    slug: f.slug,
    en: f.displayTitle || f.name,
    ro: ro || undefined,
    g: f.gender === 'Female' ? 'F' : 'M',
    f: rel(f.father)[0] ?? undefined,
    m: rel(f.mother)[0] ?? undefined,
    sp: rel(f.partners).length ? rel(f.partners) : undefined,
    sib: rel([...(f.siblings || []), ...(f.halfSiblingsSameFather || []), ...(f.halfSiblingsSameMother || [])]).length
      ? [...new Set(rel([...(f.siblings || []), ...(f.halfSiblingsSameFather || []), ...(f.halfSiblingsSameMother || [])]))]
      : undefined,
    ch: rel(f.children).length ? rel(f.children) : undefined,
    v: f.name === 'God' ? undefined : keys.join(' ') || undefined, // Dumnezeu e în aproape fiecare pagină
    vc: keys.length,
    y: y || undefined,
    dict: dict || undefined,
  });
}

writeFileSync(OUTPUT, JSON.stringify(out));
console.log(`people: ${out.length}, nume românești găsite: ${guessed} (${Math.round((guessed / out.length) * 100)}%)`);
console.log(`→ ${OUTPUT} (${(JSON.stringify(out).length / 1024).toFixed(0)} KB)`);

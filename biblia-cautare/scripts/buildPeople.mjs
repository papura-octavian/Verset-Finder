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
import { createMatcher, loadRccv, osisToKey } from './lib/roNames.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '..', '..', 'data-src', 'theographic');
const RCCV = join(here, '..', 'src', 'data', 'rccv.json');
const OUTPUT = join(here, '..', 'src', 'data', 'people.json');

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

// --- încărcare ---
const people = JSON.parse(readFileSync(join(SRC, 'people.json'), 'utf8'));
const verses = JSON.parse(readFileSync(join(SRC, 'verses.json'), 'utf8'));
const rccv = loadRccv(RCCV);
const matcher = createMatcher(rccv);

const verseKey = new Map(); // id înregistrare → "gn.1.27"
const order = new Map(); // "gn.1.27" → poziția canonică
verses.forEach((r, i) => {
  const key = osisToKey(r.fields.osisRef);
  if (!key) return;
  verseKey.set(r.id, key);
  order.set(key, i);
});

function romanianName(name, keys, title) {
  return { ro: OVERRIDES[title] || OVERRIDES[name] || matcher(name, keys) };
}

// Numele de femei apar des la genitiv-dativ („Mariei", „Rebecii"): dacă forma de
// nominativ („Maria", „Rebeca") există undeva în RCCV, o preferăm.
function nominative(w) {
  for (const [re, to] of [[/ei$/, 'a'], [/ii$/, 'a'], [/iei$/, 'ia'], [/ei$/, 'e']]) {
    const alt = w.replace(re, to);
    if (alt !== w && rccv.vocabulary.has(alt)) return alt;
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

// Personajele Bibliei (pagina „Personaje"): date din setul Theographic (CC BY-SA 4.0),
// convertite de scripts/buildPeople.mjs, cu numele românești deduse din RCCV.
// Modul pur (date → obiecte), fără UI.

import data from '../data/people.json';
import { norm } from './search.js';

export const PEOPLE = data;
const byId = new Map(data.map((p) => [p.id, p]));
const bySlug = new Map(data.map((p) => [p.slug, p]));

export const getPerson = (id) => byId.get(id) || null;
export const personBySlug = (slug) => bySlug.get(slug) || null;

/** Numele afișat: forma din Cornilescu, sau cea englezească dacă nu am găsit-o. */
export function personName(p, lang = 'ro') {
  return lang === 'en' ? p.en : p.ro || p.en.replace(/\s*\(.*\)$/, '');
}

/** Versetele în care apare (chei „gn.1.27"), în ordine canonică. */
export function personVerses(p) {
  return p.v ? p.v.split(' ') : [];
}

/** O descriere scurtă, ca să deosebești cei 30 de „Zaharia": fiul lui X, soția lui Y… */
// Descrieri potrivite unde relațiile din date ar suna greșit („Dumnezeu, tatăl lui Adam").
const SPECIAL_SUBTITLES = {
  God: 'Creatorul cerurilor și al pământului',
  'Jesus Christ': 'Mesia, Fiul lui Dumnezeu',
  'Holy Spirit': 'Duhul lui Dumnezeu',
};

/** Pentru Isus, Iosif e tatăl după lege (Matei 1:16), nu tatăl după trup. */
export function fatherLabel(p) {
  return p.en === 'Jesus Christ' ? 'Tată (după lege)' : 'Tată';
}

export function personSubtitle(p, lang = 'ro') {
  if (lang === 'ro' && SPECIAL_SUBTITLES[p.en]) return SPECIAL_SUBTITLES[p.en];
  const F = p.g === 'F';
  const rel = (id) => {
    const o = byId.get(id);
    return o ? personName(o, lang) : null;
  };
  if (lang === 'en') {
    const m = p.en.match(/\((.*)\)$/);
    if (m) return m[1];
  }
  if (p.f != null && rel(p.f)) return `${F ? 'fiica' : 'fiul'} lui ${rel(p.f)}`;
  if (p.sp?.length && rel(p.sp[0])) return `${F ? 'soția' : 'soțul'} lui ${rel(p.sp[0])}`;
  if (p.m != null && rel(p.m)) return `mama: ${rel(p.m)}`;
  if (p.ch?.length && rel(p.ch[0])) return `${F ? 'mama' : 'tatăl'} lui ${rel(p.ch[0])}`;
  return '';
}

/** Anul ca text: −1573 → „1573 î.Hr.". */
export function fmtYear(y) {
  if (y == null) return null;
  return y < 0 ? `${-y} î.Hr.` : `${y} d.Hr.`;
}

/**
 * Ascendența: de la cel mai vechi strămoș cunoscut până la persoană (pe linia
 * tatălui; mama când tatăl lipsește). Dumnezeu (Luca 3:38) rămâne capătul liniei.
 */
export function ancestry(p) {
  const chain = [];
  const seen = new Set();
  let cur = p;
  while (cur && !seen.has(cur.id) && chain.length < 120) {
    seen.add(cur.id);
    chain.push(cur);
    cur = cur.f != null ? byId.get(cur.f) : cur.m != null ? byId.get(cur.m) : null;
  }
  return chain.reverse();
}

/** Câți urmași cunoscuți are (toate generațiile). */
export function descendantCount(p) {
  const seen = new Set();
  const stack = [...(p.ch || [])];
  while (stack.length) {
    const id = stack.pop();
    if (seen.has(id)) continue;
    seen.add(id);
    stack.push(...(byId.get(id)?.ch || []));
  }
  return seen.size;
}

// Persoanele dintr-un verset (cheie → [id]), construit la prima cerere.
let verseIndex = null;
export function peopleInVerse(key) {
  if (!verseIndex) {
    verseIndex = new Map();
    for (const p of data) {
      for (const k of personVerses(p)) {
        const list = verseIndex.get(k);
        if (list) list.push(p.id);
        else verseIndex.set(k, [p.id]);
      }
    }
  }
  return (verseIndex.get(key) || []).map((id) => byId.get(id));
}

// Text de căutare per persoană (nume RO + EN, fără diacritice).
const hay = new Map(data.map((p) => [p.id, norm(`${p.ro || ''} ${p.en}`)]));

/**
 * Filtrează și sortează lista. sort: 'mentions' | 'alpha' | 'time'.
 * gender: 'all' | 'M' | 'F'.
 */
export function findPeople(query, { gender = 'all', sort = 'mentions' } = {}) {
  const tokens = norm(query || '').trim().split(/\s+/).filter(Boolean);
  let list = data.filter((p) => (gender === 'all' || p.g === gender) && tokens.every((t) => hay.get(p.id).includes(t)));
  if (tokens.length) {
    // Potrivirea pe începutul numelui românesc vine prima („ioan" → Ioan înaintea lui Ioanan).
    const first = tokens[0];
    const starts = (p) => (norm(personName(p)).startsWith(first) ? 0 : 1);
    list = list.sort((a, b) => starts(a) - starts(b) || b.vc - a.vc);
    return list;
  }
  if (sort === 'alpha') return list.sort((a, b) => personName(a).localeCompare(personName(b), 'ro'));
  if (sort === 'time') {
    const year = (p) => (p.y?.[0] ?? p.y?.[1] ?? Infinity);
    return list.filter((p) => p.y).sort((a, b) => year(a) - year(b));
  }
  return list.sort((a, b) => b.vc - a.vc);
}

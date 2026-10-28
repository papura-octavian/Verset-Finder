// Evenimentele Bibliei (pagina „Cronologie"): date Theographic (CC BY-SA 4.0), cu anii
// după cronologia tradițională (Ussher), convertite de scripts/buildPlaces.mjs.

import data from '../data/events.json';
import { norm } from './search.js';

export const EVENTS = data;
const byId = new Map(data.map((e) => [e.id, e]));
export const getEvent = (id) => byId.get(id) || null;

/** Epocile pentru împărțirea cronologiei (ani: negativ = î.Hr.). */
export const ERAS = [
  { id: 'inceput', label: 'Începuturile', from: -Infinity, to: -2000 },
  { id: 'patriarhi', label: 'Patriarhii', from: -2000, to: -1706 },
  { id: 'egipt', label: 'Egiptul și Exodul', from: -1706, to: -1450 },
  { id: 'judecatori', label: 'Cucerirea și Judecătorii', from: -1450, to: -1095 },
  { id: 'regat', label: 'Regatul unit', from: -1095, to: -975 },
  { id: 'impartit', label: 'Regatul împărțit', from: -975, to: -586 },
  { id: 'exil', label: 'Exilul și întoarcerea', from: -586, to: -100 },
  { id: 'isus', label: 'Viața lui Isus', from: -100, to: 30.5 },
  { id: 'biserica', label: 'Biserica primară', from: 30.5, to: Infinity },
];

// Isus și Biserica primară se întâlnesc în anul 30, deci granița e un eveniment, nu un an:
// tot ce vine (în ordinea cronologică a datelor) de la „Făgăduința Duhului Sfânt" încolo.
const CHURCH_FROM = data.findIndex((e) => e.id === 304);
const position = new Map(data.map((e, i) => [e.id, i]));

export function eraOf(e) {
  if (CHURCH_FROM >= 0 && position.get(e.id) >= CHURCH_FROM) return ERAS[ERAS.length - 1];
  return ERAS.find((x) => e.y >= x.from && e.y < x.to && x.id !== 'biserica') || ERAS[ERAS.length - 2];
}

export function eventTitle(e) {
  return e.ro || e.en;
}

export const isLifetime = (e) => /^Lifetime of /.test(e.en);

/** „1446 î.Hr." / „30 d.Hr." / „1094–1054 î.Hr." */
export function fmtSpan(e) {
  const y = (n) => Math.abs(n);
  const era = (n) => (n < 0 ? 'î.Hr.' : 'd.Hr.');
  if (e.ye != null && e.ye !== e.y) {
    if ((e.y < 0) === (e.ye < 0)) return `${y(e.y)}–${y(e.ye)} ${era(e.y)}`;
    return `${y(e.y)} ${era(e.y)} – ${y(e.ye)} ${era(e.ye)}`;
  }
  return `${y(e.y)} ${era(e.y)}`;
}

export function eventVerses(e) {
  return e.v ? e.v.split(' ') : [];
}

let byPerson = null;
let byPlace = null;
function index() {
  if (byPerson) return;
  byPerson = new Map();
  byPlace = new Map();
  for (const e of data) {
    for (const id of e.p || []) (byPerson.get(id) || byPerson.set(id, []).get(id)).push(e);
    for (const id of e.l || []) (byPlace.get(id) || byPlace.set(id, []).get(id)).push(e);
  }
}
export function eventsOfPerson(id) {
  index();
  return byPerson.get(id) || [];
}
export function eventsAtPlace(id) {
  index();
  return byPlace.get(id) || [];
}

const hay = new Map(data.map((e) => [e.id, norm(`${e.ro || ''} ${e.en}`)]));
export function matchesEvent(e, query) {
  const tokens = norm(query || '').trim().split(/\s+/).filter(Boolean);
  return tokens.every((t) => hay.get(e.id).includes(t));
}

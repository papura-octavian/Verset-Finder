// Locurile din Biblie (pagina „Locuri"): date Theographic (CC BY-SA 4.0) cu coordonate
// OpenBible.info, convertite de scripts/buildPlaces.mjs; nume românești deduse din RCCV.

import data from '../data/places.json';
import { norm } from './search.js';

export const PLACES = data;
const byId = new Map(data.map((p) => [p.id, p]));
const bySlug = new Map(data.map((p) => [p.slug, p]));

export const getPlace = (id) => byId.get(id) || null;
export const placeBySlug = (slug) => bySlug.get(slug) || null;
export const hasCoords = (p) => p.lat != null && p.lon != null;

export const PLACE_TYPES = {
  city: 'Oraș',
  region: 'Ținut',
  water: 'Apă',
  mountain: 'Munte',
  valley: 'Vale',
  island: 'Insulă',
  landmark: 'Loc însemnat',
  path: 'Drum',
  place: 'Loc',
};

export function placeName(p) {
  return p.ro || p.en.replace(/\s*\(.*\)$/, '');
}

export function placeVerses(p) {
  return p.v ? p.v.split(' ') : [];
}

// Locurile dintr-un verset (cheie → [id]), construit la prima cerere.
let verseIndex = null;
export function placesInVerse(key) {
  if (!verseIndex) {
    verseIndex = new Map();
    for (const p of data) {
      for (const k of placeVerses(p)) {
        const list = verseIndex.get(k);
        if (list) list.push(p.id);
        else verseIndex.set(k, [p.id]);
      }
    }
  }
  return (verseIndex.get(key) || []).map((id) => byId.get(id));
}

const hay = new Map(data.map((p) => [p.id, norm(`${p.ro || ''} ${p.en}`)]));

/** Filtrează după text și tip ('all' sau o cheie din PLACE_TYPES); cele mai pomenite primele. */
export function findPlaces(query, { type = 'all' } = {}) {
  const tokens = norm(query || '').trim().split(/\s+/).filter(Boolean);
  const list = data.filter((p) => (type === 'all' || p.t === type) && tokens.every((t) => hay.get(p.id).includes(t)));
  if (!tokens.length) return list.sort((a, b) => b.vc - a.vc);
  const first = tokens[0];
  const starts = (p) => (norm(placeName(p)).startsWith(first) ? 0 : 1);
  return list.sort((a, b) => starts(a) - starts(b) || b.vc - a.vc);
}

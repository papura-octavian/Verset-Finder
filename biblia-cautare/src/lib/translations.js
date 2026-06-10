import roData from '../data/rccv.json';
import enData from '../data/asv.json';
import { BOOKS_RO, BOOKS_EN } from '../data/books.js';

// Registrul traducerilor selectabile (Biblia principală în care se caută).
// Datele vin din scripts/convertBibles.mjs (surse: data-src/, vezi
// THIRD_PARTY_NOTICES.md). Ca să adaugi alta: convertește-o la aceeași
// structură în src/data/, adaugă maparea de cărți în books.js și o intrare aici.
export const TRANSLATIONS = {
  rccv: {
    id: 'rccv',
    label: 'Cornilescu corectată (RCCV)',
    attribution: 'RCCV',
    lang: 'ro',
    data: roData,
    books: BOOKS_RO,
  },
  asv: {
    id: 'asv',
    label: 'American Standard Version (ASV)',
    attribution: 'ASV',
    lang: 'en',
    data: enData,
    books: BOOKS_EN,
  },
};

export const TRANSLATION_LIST = Object.values(TRANSLATIONS);
export const DEFAULT_TRANSLATION = 'rccv';

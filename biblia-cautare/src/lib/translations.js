import roData from '../data/ro_cornilescu.json';
import enData from '../data/en_kjv.json';
import { BOOKS_RO, BOOKS_EN } from '../data/books.js';

// Registrul traducerilor selectabile (Biblia principală în care se caută).
// Ca să adaugi alta: pune JSON-ul (aceeași structură) în src/data/, importă-l,
// adaugă o mapare de cărți în books.js și o intrare aici.
export const TRANSLATIONS = {
  vdc: {
    id: 'vdc',
    label: 'Cornilescu (VDC 1924)',
    attribution: 'Cornilescu',
    lang: 'ro',
    data: roData,
    books: BOOKS_RO,
  },
  kjv: {
    id: 'kjv',
    label: 'King James Version',
    attribution: 'KJV',
    lang: 'en',
    data: enData,
    books: BOOKS_EN,
  },
};

export const TRANSLATION_LIST = Object.values(TRANSLATIONS);
export const DEFAULT_TRANSLATION = 'vdc';

// „Versetul zilei" — 100% client-side, determinist după dată (aceeași zi => același
// verset, pentru toată lumea). Listă curată de versete cunoscute; evităm capitolele
// unde versificarea KJV diferă de Cornilescu, ca referința să fie corectă în ambele.
export const VOTD_REFS = [
  { abbrev: 'gn', chapter: 1, verse: 1 },
  { abbrev: 'ps', chapter: 19, verse: 1 },
  { abbrev: 'ps', chapter: 23, verse: 1 },
  { abbrev: 'ps', chapter: 23, verse: 4 },
  { abbrev: 'ps', chapter: 27, verse: 1 },
  { abbrev: 'ps', chapter: 34, verse: 8 },
  { abbrev: 'ps', chapter: 37, verse: 4 },
  { abbrev: 'ps', chapter: 46, verse: 1 },
  { abbrev: 'ps', chapter: 46, verse: 10 },
  { abbrev: 'ps', chapter: 56, verse: 3 },
  { abbrev: 'ps', chapter: 91, verse: 1 },
  { abbrev: 'ps', chapter: 100, verse: 4 },
  { abbrev: 'ps', chapter: 103, verse: 2 },
  { abbrev: 'ps', chapter: 118, verse: 24 },
  { abbrev: 'ps', chapter: 119, verse: 105 },
  { abbrev: 'ps', chapter: 121, verse: 1 },
  { abbrev: 'ps', chapter: 121, verse: 2 },
  { abbrev: 'ps', chapter: 139, verse: 14 },
  { abbrev: 'ps', chapter: 143, verse: 8 },
  { abbrev: 'ps', chapter: 145, verse: 18 },
  { abbrev: 'prv', chapter: 3, verse: 5 },
  { abbrev: 'prv', chapter: 3, verse: 6 },
  { abbrev: 'prv', chapter: 16, verse: 3 },
  { abbrev: 'prv', chapter: 18, verse: 10 },
  { abbrev: 'prv', chapter: 22, verse: 6 },
  { abbrev: 'is', chapter: 26, verse: 3 },
  { abbrev: 'is', chapter: 40, verse: 31 },
  { abbrev: 'is', chapter: 41, verse: 10 },
  { abbrev: 'is', chapter: 53, verse: 5 },
  { abbrev: 'jr', chapter: 29, verse: 11 },
  { abbrev: 'mt', chapter: 5, verse: 14 },
  { abbrev: 'mt', chapter: 5, verse: 16 },
  { abbrev: 'mt', chapter: 6, verse: 33 },
  { abbrev: 'mt', chapter: 6, verse: 34 },
  { abbrev: 'mt', chapter: 7, verse: 7 },
  { abbrev: 'mt', chapter: 11, verse: 28 },
  { abbrev: 'mt', chapter: 28, verse: 19 },
  { abbrev: 'jo', chapter: 1, verse: 1 },
  { abbrev: 'jo', chapter: 3, verse: 16 },
  { abbrev: 'jo', chapter: 8, verse: 12 },
  { abbrev: 'jo', chapter: 10, verse: 10 },
  { abbrev: 'jo', chapter: 11, verse: 25 },
  { abbrev: 'jo', chapter: 13, verse: 34 },
  { abbrev: 'jo', chapter: 14, verse: 6 },
  { abbrev: 'jo', chapter: 14, verse: 27 },
  { abbrev: 'jo', chapter: 15, verse: 5 },
  { abbrev: 'jo', chapter: 16, verse: 33 },
  { abbrev: 'rm', chapter: 5, verse: 8 },
  { abbrev: 'rm', chapter: 8, verse: 28 },
  { abbrev: 'rm', chapter: 10, verse: 9 },
  { abbrev: 'rm', chapter: 12, verse: 2 },
  { abbrev: 'rm', chapter: 15, verse: 13 },
  { abbrev: '1co', chapter: 13, verse: 4 },
  { abbrev: '2co', chapter: 5, verse: 17 },
  { abbrev: '2co', chapter: 12, verse: 9 },
  { abbrev: 'gl', chapter: 5, verse: 22 },
  { abbrev: 'eph', chapter: 2, verse: 8 },
  { abbrev: 'ph', chapter: 1, verse: 6 },
  { abbrev: 'ph', chapter: 4, verse: 6 },
  { abbrev: 'ph', chapter: 4, verse: 13 },
  { abbrev: 'cl', chapter: 3, verse: 23 },
  { abbrev: '1ts', chapter: 5, verse: 16 },
  { abbrev: '2tm', chapter: 1, verse: 7 },
  { abbrev: 'hb', chapter: 4, verse: 16 },
  { abbrev: 'hb', chapter: 11, verse: 1 },
  { abbrev: 'hb', chapter: 13, verse: 5 },
  { abbrev: 'jm', chapter: 1, verse: 2 },
  { abbrev: 'jm', chapter: 1, verse: 5 },
  { abbrev: 'jm', chapter: 1, verse: 12 },
  { abbrev: 're', chapter: 21, verse: 4 },
];

// Index determinist pe zi (numărul de zile de la epocă, calculat din data locală).
function dayIndex(date, len) {
  const day = Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
  return ((day % len) + len) % len;
}

/**
 * Versetul zilei pentru indexul (traducerea) activă. Caută referințele curate în
 * ordine, începând de la cea a zilei, și o întoarce pe prima găsită. null dacă niciuna.
 */
export function verseOfDay(index, date = new Date()) {
  if (!index || !index.length) return null;
  const n = VOTD_REFS.length;
  const start = dayIndex(date, n);
  for (let k = 0; k < n; k++) {
    const ref = VOTD_REFS[(start + k) % n];
    const found = index.find(
      (v) => v.abbrev === ref.abbrev && v.chapter === ref.chapter && v.verse === ref.verse
    );
    if (found) return found;
  }
  return null;
}

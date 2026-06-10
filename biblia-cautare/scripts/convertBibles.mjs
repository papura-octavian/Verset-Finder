// Convertește textele biblice brute în formatul aplicației:
//   [{ abbrev, name, chapters: [[versete...]] }]  (același ca datele vechi,
//   cu ACELEAȘI abrevieri din src/data/books.js — cheile de adnotări,
//   trimiteri și URL-uri rămân valabile).
//
// Surse (locale, NU intră în git — vezi <repo>/data-src/):
//   - data-src/ron-rccv.usfx.xml   — RCCV (Romanian Corrected Cornilescu
//     Version, 2013-09-09, lineage eBible.org), format USFX.
//   - data-src/eng-asv.zefania.xml — ASV (American Standard Version 1901),
//     format Zefania XML (sourceforge.net/projects/zefania-sharp).
//
// Rulare (din biblia-cautare/):  node scripts/convertBibles.mjs
// Ieșire: src/data/rccv.json + src/data/asv.json

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { BOOKS_RO, BOOKS_EN } from '../src/data/books.js';

const here = dirname(fileURLToPath(import.meta.url));
const SRC = join(here, '..', '..', 'data-src');
const OUT = join(here, '..', 'src', 'data');

// Codurile USFM (din USFX) → abrevierile aplicației.
const USFM = {
  GEN: 'gn', EXO: 'ex', LEV: 'lv', NUM: 'nm', DEU: 'dt', JOS: 'js',
  JDG: 'jud', RUT: 'rt', '1SA': '1sm', '2SA': '2sm', '1KI': '1kgs',
  '2KI': '2kgs', '1CH': '1ch', '2CH': '2ch', EZR: 'ezr', NEH: 'ne',
  EST: 'et', JOB: 'job', PSA: 'ps', PRO: 'prv', ECC: 'ec', SNG: 'so',
  ISA: 'is', JER: 'jr', LAM: 'lm', EZK: 'ez', DAN: 'dn', HOS: 'ho',
  JOL: 'jl', AMO: 'am', OBA: 'ob', JON: 'jn', MIC: 'mi', NAM: 'na',
  HAB: 'hk', ZEP: 'zp', HAG: 'hg', ZEC: 'zc', MAL: 'ml',
  MAT: 'mt', MRK: 'mk', LUK: 'lk', JHN: 'jo', ACT: 'act', ROM: 'rm',
  '1CO': '1co', '2CO': '2co', GAL: 'gl', EPH: 'eph', PHP: 'ph', COL: 'cl',
  '1TH': '1ts', '2TH': '2ts', '1TI': '1tm', '2TI': '2tm', TIT: 'tt',
  PHM: 'phm', HEB: 'hb', JAS: 'jm', '1PE': '1pe', '2PE': '2pe',
  '1JN': '1jo', '2JN': '2jo', '3JN': '3jo', JUD: 'jd', REV: 're',
};

// Ordinea canonică 1–66 → abrevieri (pentru bnumber-ul din Zefania).
const CANON = Object.entries(BOOKS_RO)
  .sort((a, b) => a[1].order - b[1].order)
  .map(([abbrev]) => abbrev);

function decodeEntities(s) {
  return s
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');
}

function cleanText(s) {
  return decodeEntities(s.replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim();
}

// Golurile de numerotare devin '' ca să rămână alinierea 1-based.
function solidify(chapters) {
  return chapters.map((verses) => Array.from(verses, (v) => v ?? ''));
}

// --- RCCV din USFX: text între marcajele-milestone <c id/> și <v id/>. ---
function parseUsfx(xml, names) {
  const books = [];
  const bookRe = /<book id="([A-Z0-9]+)"[^>]*>([\s\S]*?)<\/book>/g;
  let bridges = 0;
  for (const [, code, raw] of xml.matchAll(bookRe)) {
    const abbrev = USFM[code];
    if (!abbrev) {
      console.warn(`  ATENȚIE: cod USFM nemapat: ${code}`);
      continue;
    }
    // Scoate elementele care nu sunt text de verset (id, titluri, antete).
    const content = raw
      .replace(/<id[^>]*>[\s\S]*?<\/id>/g, '')
      .replace(/<h\b[^>]*>[\s\S]*?<\/h>/g, '')
      .replace(/<p sfm="mt"[^>]*>[\s\S]*?<\/p>/g, '')
      .replace(/<ide[^>]*\/>/g, '');

    const chapters = [];
    let c = 0;
    let v = 0;
    // Păstrează marcajele la split ca să știm mereu capitolul/versetul curent.
    for (const part of content.split(/(<c id="\d+"\s*\/>|<v id="[\d-]+"\s*\/>)/)) {
      let m = part.match(/^<c id="(\d+)"\s*\/>$/);
      if (m) {
        c = Number(m[1]);
        chapters[c - 1] ??= [];
        v = 0;
        continue;
      }
      m = part.match(/^<v id="(\d+)(?:-(\d+))?"\s*\/>$/);
      if (m) {
        v = Number(m[1]);
        if (m[2]) bridges++;
        continue;
      }
      if (!c || !v) continue; // text dinaintea primului verset (titluri etc.)
      const text = cleanText(part);
      if (!text) continue;
      const ch = chapters[c - 1];
      ch[v - 1] = ch[v - 1] ? ch[v - 1] + ' ' + text : text;
    }
    books.push({ abbrev, name: names[abbrev].name, chapters: solidify(chapters) });
  }
  if (bridges) console.log(`  (versete-punte în USFX: ${bridges} — text pus la primul verset)`);
  return books;
}

// --- ASV din Zefania: BIBLEBOOK bnumber → CHAPTER cnumber → VERS vnumber. ---
function parseZefania(xml, names) {
  const books = [];
  const bookRe = /<BIBLEBOOK bnumber="(\d+)"[^>]*>([\s\S]*?)<\/BIBLEBOOK>/g;
  for (const [, bnum, bookRaw] of xml.matchAll(bookRe)) {
    const abbrev = CANON[Number(bnum) - 1];
    if (!abbrev) {
      console.warn(`  ATENȚIE: bnumber în afara canonului: ${bnum}`);
      continue;
    }
    const chapters = [];
    const chapRe = /<CHAPTER cnumber="(\d+)"[^>]*>([\s\S]*?)<\/CHAPTER>/g;
    for (const [, cnum, chapRaw] of bookRaw.matchAll(chapRe)) {
      const verses = [];
      const versRe = /<VERS vnumber="(\d+)"[^>]*>([\s\S]*?)<\/VERS>/g;
      for (const [, vnum, versRaw] of chapRaw.matchAll(versRe)) {
        // Parantezele drepte marchează cuvintele adăugate — păstrăm cuvântul.
        const text = cleanText(versRaw.replace(/<NOTE[^>]*>[\s\S]*?<\/NOTE>/g, '')).replace(/[[\]]/g, '');
        verses[Number(vnum) - 1] = text;
      }
      chapters[Number(cnum) - 1] = verses;
    }
    books.push({ abbrev, name: names[abbrev].name, chapters: solidify(chapters.map((ch) => ch ?? [])) });
  }
  return books;
}

function report(label, books) {
  const totalVerses = books.reduce((s, b) => s + b.chapters.reduce((x, c) => x + c.length, 0), 0);
  const empty = books.reduce((s, b) => s + b.chapters.reduce((x, c) => x + c.filter((v) => !v).length, 0), 0);
  const ps = books.find((b) => b.abbrev === 'ps');
  const jo316 = books.find((b) => b.abbrev === 'jo')?.chapters[2]?.[15];
  console.log(`${label}: ${books.length} cărți, ${totalVerses} versete (${empty} goale), Psalmi: ${ps?.chapters.length} capitole`);
  console.log(`  Ioan 3:16 → ${jo316?.slice(0, 90)}…`);
}

console.log('Convertesc RCCV (USFX)…');
const rccv = parseUsfx(readFileSync(join(SRC, 'ron-rccv.usfx.xml'), 'utf8'), BOOKS_RO);
report('RCCV', rccv);
writeFileSync(join(OUT, 'rccv.json'), JSON.stringify(rccv));

console.log('Convertesc ASV (Zefania)…');
const asv = parseZefania(readFileSync(join(SRC, 'eng-asv.zefania.xml'), 'utf8'), BOOKS_EN);
report('ASV', asv);
writeFileSync(join(OUT, 'asv.json'), JSON.stringify(asv));

// Diferențe de structură între cele două (informativ — versificări diferite).
let chapDiff = 0;
for (const rb of rccv) {
  const ab = asv.find((b) => b.abbrev === rb.abbrev);
  if (!ab) continue;
  if (ab.chapters.length !== rb.chapters.length) {
    chapDiff++;
    console.log(`  DIFERĂ capitole: ${rb.abbrev} RCCV=${rb.chapters.length} ASV=${ab.chapters.length}`);
  }
}
if (!chapDiff) console.log('Numărul de capitole coincide în toate cele 66 de cărți.');
console.log('Gata: src/data/rccv.json + src/data/asv.json');

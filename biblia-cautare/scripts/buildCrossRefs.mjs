// Convertește setul de trimiteri de la openbible.info în formatul aplicației.
//
// Sursa (descărcată manual, NU intră în git):
//   https://a.openbible.info/data/cross-references.zip
//   → dezarhivat ca <repo>/data-src/cross_references.txt
//   Format TSV cu antet: "From Verse  To Verse  Votes", id-uri OSIS (Gen.1.1),
//   intervale "Rom.5.8-Rom.5.9". Licență CC-BY (atribuire: openbible.info).
//
// Rulare (din biblia-cautare/):  node scripts/buildCrossRefs.mjs
// Ieșire: src/data/crossrefs.json — { "jo.3.16": "rm.5.8 1jo.4.9-10 ..." }
//   (cheie = versetul-sursă; valoare = țintele top-MAX_PER_VERSE după voturi,
//    separate prin spațiu; intervalele doar în același capitol).
//
// Validare pe numerotarea ASV (TSK e construit pe linia KJV/ASV): referințele
// către capitole/versete inexistente în asv.json se aruncă.

import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const MAX_PER_VERSE = 10;

const here = dirname(fileURLToPath(import.meta.url));
const INPUT = join(here, '..', '..', 'data-src', 'cross_references.txt');
const ASV = join(here, '..', 'src', 'data', 'asv.json');
const OUTPUT = join(here, '..', 'src', 'data', 'crossrefs.json');

// OSIS (openbible.info) → abrevierile aplicației (src/data/books.js).
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

// Hartă abbrev → [nr. versete per capitol], pentru validare.
const asv = JSON.parse(readFileSync(ASV, 'utf8'));
const sizes = {};
for (const book of asv) sizes[book.abbrev] = book.chapters.map((c) => c.length);

const unmapped = new Set();

/** "Gen.1.1" → { abbrev, chapter, verse } valid, sau null. */
function parseId(raw) {
  const m = raw.match(/^(.+)\.(\d+)\.(\d+)$/);
  if (!m) return null;
  const abbrev = OSIS[m[1]];
  if (!abbrev) {
    unmapped.add(m[1]);
    return null;
  }
  const chapter = Number(m[2]);
  const verse = Number(m[3]);
  const ch = sizes[abbrev]?.[chapter - 1];
  if (!ch || verse < 1 || verse > ch) return null;
  return { abbrev, chapter, verse };
}

/** O coloană (poate fi interval "A-B") → cheia-sursă sau ținta codificată. */
function parseColumn(raw, asTarget) {
  const [a, b] = raw.split('-');
  const start = parseId(a);
  if (!start) return null;
  const key = `${start.abbrev}.${start.chapter}.${start.verse}`;
  if (!asTarget || !b) return key;
  const end = parseId(b);
  // Interval păstrat doar în același capitol; altfel rămâne primul verset.
  if (end && end.abbrev === start.abbrev && end.chapter === start.chapter && end.verse > start.verse) {
    return `${key}-${end.verse}`;
  }
  return key;
}

const lines = readFileSync(INPUT, 'utf8').split('\n');
const byFrom = new Map();
let total = 0;
let dropped = 0;

for (const line of lines) {
  const cols = line.trim().split('\t');
  if (cols.length < 3 || cols[0].startsWith('From')) continue;
  total++;
  const votes = Number(cols[2]);
  if (!Number.isFinite(votes) || votes < 0) {
    dropped++;
    continue;
  }
  const from = parseColumn(cols[0], false);
  const to = parseColumn(cols[1], true);
  if (!from || !to || to === from || to.startsWith(from + '-')) {
    dropped++;
    continue;
  }
  if (!byFrom.has(from)) byFrom.set(from, []);
  byFrom.get(from).push({ to, votes });
}

const out = {};
let kept = 0;
for (const [from, refs] of byFrom) {
  refs.sort((a, b) => b.votes - a.votes);
  const top = [];
  const seen = new Set();
  for (const r of refs) {
    if (seen.has(r.to)) continue; // dublurile (același țintă listată de 2 ori)
    seen.add(r.to);
    top.push(r.to);
    if (top.length === MAX_PER_VERSE) break;
  }
  out[from] = top.join(' ');
  kept += top.length;
}

const json = JSON.stringify(out);
writeFileSync(OUTPUT, json);

console.log(`Rânduri în sursă:    ${total}`);
console.log(`Aruncate (invalide/negative): ${dropped}`);
console.log(`Versete cu trimiteri: ${byFrom.size}`);
console.log(`Trimiteri păstrate:   ${kept} (max ${MAX_PER_VERSE}/verset)`);
console.log(`Mărime ieșire:        ${(json.length / 1024 / 1024).toFixed(2)} MB → ${OUTPUT}`);
if (unmapped.size) console.log(`ATENȚIE — id-uri OSIS nemapate: ${[...unmapped].join(', ')}`);

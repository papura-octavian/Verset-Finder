# Verset Finder — aplicația

Web app **statică** (React + Vite + Tailwind) pentru căutare în Biblie, studiu și
predici. Traduceri: **Cornilescu corectată (RCCV)** și **American Standard
Version (ASV)**. Funcționează **offline** (un singur `index.html`, deschis prin
dublu-click) și **online** (GitHub Pages — versetfinder.study). Fără backend.

Lista completă de funcții: vezi [README-ul principal](../README.md).

## Dezvoltare

```bash
npm install
npm run dev      # http://localhost:5173
```

## Build (offline + online)

```bash
npm run build    # => dist/index.html (totul inline într-un singur fișier)
```

- **Offline:** deschide `dist/index.html` prin dublu-click — fără server, fără internet.
- **Online:** publicat automat pe GitHub Pages prin `.github/workflows/static.yml`.

## Date (regenerare)

Sursele brute stau local în `../data-src/` (nu intră în git — vezi
`../THIRD_PARTY_NOTICES.md` pentru proveniență și licențe):

```bash
node scripts/convertBibles.mjs    # ron-rccv.usfx.xml + eng-asv.zefania.xml → src/data/{rccv,asv}.json
node scripts/buildCrossRefs.mjs   # cross_references.txt (openbible.info) → src/data/crossrefs.json
```

## Structură

- `src/data/rccv.json` / `src/data/asv.json` — textele Bibliei RO / EN (generate).
- `src/data/crossrefs.json` — trimiterile, top ~10 per verset (generate).
- `src/data/books.js` — mapări `abbrev → { nume, testament, ordine }` RO + EN (66 cărți).
- `src/lib/translations.js` — registrul traducerilor selectabile.
- `src/lib/hash.js` — schema URL cu hash (`#rccv/jo.3.16`, `#rccv/r/jo.3`, `#rccv/q=...`),
  cu aliasuri pentru id-urile vechi (`vdc`→`rccv`, `kjv`→`asv`).
- `src/lib/buildIndex.js` / `search.js` — indexul de căutare + normalizare diacritice.
- `src/lib/reference.js` — căutarea după referință (`@ioan 3:16`).
- `src/lib/reader.js` — acces text pe capitol + navigare carte↔capitol.
- `src/lib/annotations.js` — semne de carte / evidențieri / note (localStorage).
- `src/lib/sermons.js` — predicile (IndexedDB, cu fallback localStorage).
- `src/lib/crossrefs.js` — accesul la trimiteri.
- `src/components/` — UI: căutare (`SearchBar`, `ResultList`, `VerseCard`),
  cititor (`Reader`, `ChapterView`, `VerseActions`, `CrossRefsList`),
  pagini (`SavedView`, `SermonsView`), navigație (`NavDrawer`), `Markdown`.

## Licență / atribuire

Codul aplicației: **MIT** (vezi `../LICENSE`). Sursele și licențele datelor
(texte biblice — domeniu public; trimiteri — CC-BY openbible.info):
`../THIRD_PARTY_NOTICES.md`.

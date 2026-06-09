# Caută în Biblie — Cornilescu (VDC 1924)

Web app **statică** pentru căutarea de cuvinte / fraze în Biblie. Traducere
selectabilă: **Cornilescu (VDC 1924)** sau **King James Version (KJV)**. Funcționează
**offline** (un singur `index.html`, deschis prin dublu-click) și se poate **publica
online** (GitHub Pages / Netlify / Vercel). Fără backend.

## Funcții

- **Fără diacritice** (mereu activ): „credinta” găsește „credinţă”, „pamint” găsește „pămînt”.
  Acoperă și ortografia veche cu sedilă (`ş`, `ţ`) și `î/â`.
- **Cuvânt întreg** (toggle): ON → „har” nu mai prinde „harul”; OFF → căutare parțială.
- **Frază exactă** (toggle): ON → tot textul ca un singur șir; OFF → toate cuvintele (AND), în orice ordine.
- **Filtru pe carte + capitole**: limitează la o carte (grupate VT / NT) și, opțional, la anumite capitole (`1-3, 5, 8-10`).
- **Selector de traducere** (antet, lângă dark mode): alegi Biblia în care cauți — Cornilescu (VDC 1924) sau King James Version. Referințele și numele cărților sunt în limba traducerii (ex. „Ioan 3:16" vs „John 3:16"). Alegerea se păstrează local. Ușor de extins — vezi `src/lib/translations.js`.
- **Istoric căutări**: termenii confirmați (Enter / la ieșirea din câmp) se salvează local și pot fi reluați cu un clic.
- **Copiere verset**: buton care copiază în clipboard `referință — text (traducere)`.
- **Dark mode**: comutator în antet, persistat local, respectă `prefers-color-scheme` la prima vizită (fără pâlpâire).
- Highlight pe termenii găsiți + referința (Carte cap:vers).

Preferințele (istoric, temă) se păstrează în `localStorage` și funcționează și offline pe `file://`.

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
- **Online:** urcă conținutul din `dist/` pe orice hosting static.

## Publicare pe GitHub Pages

`vite.config.js` folosește `base: './'` (căi relative) + single-file, deci merge și pe
sub-cale de tip `https://utilizator.github.io/repo/`, fără configurări suplimentare.

Cea mai simplă variantă (un singur fișier de urcat):

1. `npm run build` → obții `dist/index.html`.
2. Creează un repo pe GitHub și pune acolo acel `index.html` (în rădăcină sau în `/docs`).
3. **Settings → Pages →** sursă: branch `main`, folder `/ (root)` (sau `/docs`).
4. Gata: linkul `https://utilizator.github.io/repo/` e accesibil de pe telefon, tabletă, laptop, PC.

Alternativ, poți comite tot proiectul și construi automat cu un workflow GitHub Actions
(build → publică `dist/`), dar pentru un singur fișier pasul manual e suficient.

## Structură

- `src/data/ro_cornilescu.json` / `src/data/en_kjv.json` — textele Bibliei RO / EN (sursă: [thiagobodruk/bible](https://github.com/thiagobodruk/bible)).
- `src/lib/translations.js` — registrul traducerilor selectabile. Adaugi una nouă aici.
- `src/assets/logo.png` — logo „Verset Finder" (inline în build, folosit și ca favicon).
- `src/data/books.js` — mapări `abbrev → { nume, testament, ordine }` RO + EN (66 de cărți) + `bookList()`.
- `src/lib/buildIndex.js` — aplatizează o traducere în index + precalculează `norm`.
- `src/lib/search.js` — normalizare diacritice + filtrare cu toggle-uri + carte/capitole.
- `src/lib/storage.js` — citire/scriere sigură în `localStorage` (istoric, temă).
- `src/lib/clipboard.js` — copiere + Web Share API cu fallback-uri.
- `src/components/` — `SearchBar`, `SearchHistory`, `ResultList`, `VerseCard`.

## Licență / atribuire

Codul aplicației este publicat sub **MIT License**. Vezi `../LICENSE`.

Fișierele `ro_cornilescu.json` și `en_kjv.json` provin din
[thiagobodruk/bible](https://github.com/thiagobodruk/bible/tree/master), publicat sub
**MIT License**. Atribuirea completă este în `../THIRD_PARTY_NOTICES.md`.

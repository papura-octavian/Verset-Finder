# Verset Finder

**[versetfinder.study](https://versetfinder.study)** — aplicație web gratuită pentru
căutare în Biblie, studiu biblic și construit predici. Funcționează în browser,
fără cont, inclusiv **offline** (toată aplicația e un singur fișier HTML).

Traduceri incluse: **Cornilescu corectată (RCCV)** pentru română și
**American Standard Version (ASV)** pentru engleză.

## Funcții

### 🔍 Căutare
- Căutare instant, **fără diacritice** („credinta" găsește „credinţă").
- Filtre: Vechiul/Noul Testament, carte, capitole (`1-3, 5`), cuvânt întreg,
  frază exactă, plus „caută în rezultate" pentru îngustare.
- **Referințe directe cu `@`**: `@ioan 3:16`, `@isaia 1:1-10`, `@psalmii 23` —
  aduce direct pasajul, nu cuvinte.
- Istoric de căutări, versetul zilei, navigare din tastatură (`/`, `↑↓`, `Enter`).

### 📖 Citire
- Cititor de capitol în context (click pe orice rezultat) + pagină dedicată
  **Citește**, cu navigare carte → capitol și răsfoire ◀ ▶.
- **Comparare RCCV | ASV** vers cu vers, una lângă alta.
- Mărime text, font cu serife, link partajabil către orice pasaj
  (ex. `#rccv/jo.3.16`).

### ✏️ Studiu personal
- **Semne de carte** cu colecții (ex. „predica duminică"), **evidențieri pe
  5 culori** și **note personale** pe orice verset — totul salvat local,
  organizat în pagina **Salvate**.
- **Trimiteri (cross-references)**: la fiecare verset, cele mai relevante
  versete înrudite (date openbible.info / Treasury of Scripture Knowledge),
  vizibile și în cititor, și direct pe rezultatele căutării, cu salt la pasaj.

### 🎤 Predici
- **Editor de predici** cu markdown și toolbar simplu (titluri, liste, citate),
  comenzi de editor (Tab, Ctrl+Z/Y, Ctrl+B/I, continuare automată a listelor).
- **Inserare rapidă de versete** după referință, șabloane (predică în 3 puncte,
  studiu biblic), **mod prezentare** pe tot ecranul și export `.md`.
- Salvare automată locală (IndexedDB); pe desktop, layout tip Obsidian
  (lista de predici în stânga, scrisul în centru).

### 🌙 Altele
- Mod întunecat, optimizat pentru telefon/tabletă/desktop, deep-link-uri
  pentru orice stare (pasaj, căutare), 100% static — fără backend, fără tracking
  de date personale.

## Dezvoltare

Aplicația e în [`biblia-cautare/`](biblia-cautare/) (React + Vite + Tailwind):

```bash
cd biblia-cautare
npm install
npm run dev     # http://localhost:5173
npm run build   # => dist/index.html (un singur fișier, offline-ready)
```

Datele biblice se generează din surse brute (locale, în `data-src/`, nu intră
în git) cu scripturile din `biblia-cautare/scripts/`:
- `convertBibles.mjs` — RCCV (USFX) + ASV (Zefania XML) → JSON-ul aplicației.
- `buildCrossRefs.mjs` — trimiterile openbible.info → top 10 per verset.

Detalii tehnice: [biblia-cautare/README.md](biblia-cautare/README.md).

## Licență / surse

Codul: **MIT** ([LICENSE](LICENSE)). Textele biblice (domeniu public) și
trimiterile (CC-BY openbible.info): vezi
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

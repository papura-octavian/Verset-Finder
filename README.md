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
- **Referințe directe**: `ioan 3:16`, `Ioan 3.16`, `1 ioan 1,9`, `ps 23`,
  `isaia 1:1-10`, `iuda 3` — aduce direct pasajul, nu cuvinte (recunoscute și
  fără `@`; „caută cuvintele în schimb" când chiar voiai textul).
- Rezultate nelimitate, afișate câte 100 („Arată încă").
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

### 👥 Personaje
- **Toate persoanele numite în Biblie** (peste 3.000, de la Adam până la ultimii
  frați salutați în epistole), fiecare cu o pagină de tip wiki: familia (părinți,
  soț/soție, frați, copii), **linia strămoșilor** până la Adam, **arborele
  urmașilor**, toate versetele în care apare și nota din dicționarul Easton.
- Căutare după nume (românesc sau englezesc), filtre bărbați/femei, ordonare după
  câte versete îi pomenesc, alfabetic sau cronologic.
- În cititor, la fiecare verset apar personajele numite în el, cu link spre paginile lor.

### 🗺️ Locuri
- **Harta lumii biblice** (de la Roma la Babilon) cu toate cele ~1.300 de locuri
  din Scriptură: tragi, dai zoom (și cu două degete), atingi un punct.
- Pagina fiecărui loc: **ce s-a întâmplat acolo**, toate versetele în care apare,
  nota din dicționarul Easton și link spre locul de azi pe Google Maps.
- Funcționează și offline: harta e desenată din datele Natural Earth, fără
  servicii de hărți externe.

### 🕰️ Cronologie
- **Istoria Bibliei pe ani**, de la Creație la Pavel la Roma: ~450 de evenimente,
  pe epoci (Patriarhii, Exodul, Judecătorii, Regatul…, Viața lui Isus, Biserica primară).
- La fiecare eveniment: anul, durata, personajele, locurile (deschise pe hartă) și
  pasajul biblic. Căutare și salt la epocă.
- Personajele și locurile au și ele lista lor de evenimente; în cititor, la fiecare
  verset apar personajele și locurile numite în el.

### 🔊 Ascultă și distribuie
- **Citire cu voce tare** a capitolului sau de la un verset, cu versetul curent
  evidențiat, pauză, viteză și continuare automată la capitolul următor (vocile
  dispozitivului — funcționează și offline).
- **Imagine cu versetul** (pătrat pentru postări sau vertical pentru story, 5 teme),
  de descărcat sau trimis direct din telefon.

### 🎤 Predici
- **Editor de predici** cu markdown și toolbar simplu (titluri, liste cu
  sub-puncte, citate, separatoare), comenzi de editor (Tab, Ctrl+Z/Y, Ctrl+B/I,
  continuare automată a listelor).
- **Inserare rapidă de versete**: scrie `@ioan 3:16` pe un rând și apasă Enter,
  sau alege din referință / salvate / evidențieri / note. Șabloane (predică în
  3 puncte, studiu biblic).
- **Cuprins** cu salt la secțiune, număr de cuvinte și **durata estimată** a
  predicii, căutare în predici, copie a unei predici, „Anulează" după ștergere.
- **Mod prezentare** cu **slide-uri** (unul pe secțiune `##` sau `---`; ← →,
  Spațiu, click), text reglabil, cronometru și ecran complet — sau tot textul
  derulat.
- Export `.md`, Word (`.docx`) și PDF.
- Salvare automată locală (IndexedDB), inclusiv la închiderea bruscă a
  tab-ului; pe desktop, layout tip Obsidian (lista în stânga, scrisul în centru).

### 🌙 Altele
- **Backup și restaurare** (.json) pentru note, evidențieri, salvate și
  predici — singura cale de a nu le pierde la ștergerea datelor browserului sau
  de a le muta pe alt dispozitiv. Datele rămân sincronizate între tab-uri.
- Paginile mereu la un click (file pe desktop, bară jos pe telefon), cu
  butonul Back funcțional între ele.
- Mod întunecat, optimizat pentru telefon/tabletă/desktop, deep-link-uri
  pentru orice stare (pasaj, căutare, pagină), 100% static — fără backend, fără
  tracking de date personale.

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
- `buildPeople.mjs` — personajele din Theographic → `people.json`, cu numele
  românești deduse din RCCV.
- `buildPlaces.mjs` — locurile, evenimentele (Theographic) și harta de fundal
  (Natural Earth) → `places.json`, `events.json`, `basemap.json`.

Detalii tehnice: [biblia-cautare/README.md](biblia-cautare/README.md).

## Licență / surse

Codul: **MIT** ([LICENSE](LICENSE)). Textele biblice (domeniu public),
trimiterile (CC-BY openbible.info), personajele, locurile și evenimentele (CC BY-SA 4.0,
Theographic) și harta (Natural Earth, domeniu public): vezi
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

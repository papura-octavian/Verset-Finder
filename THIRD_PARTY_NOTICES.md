# Third-Party Notices

Acest proiect include date derivate din următoarele surse. Fișierele-sursă brute
NU sunt incluse în repository (stau local în `data-src/`); în aplicație intră
variantele convertite din `biblia-cautare/src/data/`.

## 1. Textul biblic românesc — RCCV

- **Traducere:** Romanian Corrected Cornilescu Version (RCCV) — ediția cu
  corecturi ortografice a traducerii Dumitru Cornilescu (1924), versiunea
  2013-09-09.
- **Sursă:** eBible.org (`ron-rccv`, format USFX); distribuită și prin proiectul
  Zefania XML (sourceforge.net/projects/zefania-sharp).
- **Statut:** domeniu public. Conform declarației eBible.org pentru textul
  Cornilescu 1924, copyright-ul a expirat — textul „is in the public domain and
  may be copied and distributed freely".
- **Fișier în repository:** `biblia-cautare/src/data/rccv.json`
  (convertit cu `biblia-cautare/scripts/convertBibles.mjs`).

## 2. Textul biblic englezesc — ASV

- **Traducere:** American Standard Version (1901).
- **Sursă:** Zefania XML Bible Markup Language
  (sourceforge.net/projects/zefania-sharp; publisher: Free Bible Software Group).
- **Statut:** domeniu public (copyright-ul SUA pentru ediția 1901 a expirat).
- **Fișier în repository:** `biblia-cautare/src/data/asv.json`
  (convertit cu `biblia-cautare/scripts/convertBibles.mjs`).

## 3. Trimiterile biblice (cross-references)

- **Sursă:** OpenBible.info — „Bible Cross References"
  (https://www.openbible.info/labs/cross-references/), set derivat în principal
  din Treasury of Scripture Knowledge (domeniu public), cu voturi de relevanță.
- **Licență:** Creative Commons Attribution (CC-BY). Atribuirea apare și în
  aplicație, în panoul de trimiteri: „Trimiteri: openbible.info (CC-BY)".
- **Fișier în repository:** `biblia-cautare/src/data/crossrefs.json`
  (convertit cu `biblia-cautare/scripts/buildCrossRefs.mjs`, păstrând cele mai
  relevante ~10 trimiteri per verset).

## 4. Fontul Roboto (exportul PDF al predicilor)

- **Font:** Roboto (Google), inclus prin biblioteca `pdfmake` și înglobat în
  fișierele PDF exportate din editorul de predici.
- **Licență:** Apache License 2.0 (https://www.apache.org/licenses/LICENSE-2.0).

---

Versiuni anterioare ale proiectului foloseau fișiere JSON derivate din
repository-ul `thiagobodruk/bible` (licență MIT). Acele fișiere au fost
eliminate și înlocuite cu sursele de mai sus.

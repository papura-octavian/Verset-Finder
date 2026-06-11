// Exportul .pdf al unei predici: markdown (lib/mdBlocks) → pdfmake (layout de
// text real: împărțire pe pagini, liste, stiluri). Fontul Roboto vine din vfs-ul
// pdfmake (acoperă diacriticele românești); licența — vezi THIRD_PARTY_NOTICES.md.
// `sermonToPdfDef` e pur (rulează și în Node, pentru verificare);
// `downloadPdf` e partea de browser.

import pdfMake from 'pdfmake/build/pdfmake.js';
import pdfFonts from 'pdfmake/build/vfs_fonts.js';
import { parseBlocks } from './mdBlocks.js';
import { sermonMarkdown, sermonFileSlug } from './sermons.js';

pdfMake.addVirtualFileSystem(pdfFonts);
pdfMake.fonts = {
  Roboto: {
    normal: 'Roboto-Regular.ttf',
    bold: 'Roboto-Medium.ttf',
    italics: 'Roboto-Italic.ttf',
    bolditalics: 'Roboto-MediumItalic.ttf',
  },
};

// Culorile citatului, ca în preview (Tailwind amber-300 / amber-50).
const QUOTE_BORDER = '#FCD34D';
const QUOTE_BG = '#FFFBEB';

// Inline-urile → text runs pdfmake; un rând gol de citat rămâne un spațiu
// (altfel pdfmake nu ocupă deloc rândul).
function textOf(inlines) {
  if (!inlines.length) return ' ';
  return inlines.map((r) => ({ text: r.text, bold: !!r.bold, italics: !!r.italic }));
}

/** docDefinition-ul pdfmake al unei predici (fără descărcare). */
export function sermonToPdfDef(sermon) {
  const content = [];

  for (const b of parseBlocks(sermonMarkdown(sermon))) {
    if (b.type === 'h') {
      content.push({ text: textOf(b.inlines), style: 'h' + b.level });
    } else if (b.type === 'quote') {
      // Tabel cu o singură celulă: fundal amber + linie stângă groasă (ca în preview).
      content.push({
        table: {
          widths: ['*'],
          body: [
            [
              {
                stack: b.paras.map((p) => ({ text: textOf(p), margin: [0, 1, 0, 1] })),
                fillColor: QUOTE_BG,
                margin: [10, 7, 10, 7],
              },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 0,
          vLineWidth: (i) => (i === 0 ? 3 : 0),
          vLineColor: () => QUOTE_BORDER,
          paddingLeft: () => 0,
          paddingRight: () => 0,
          paddingTop: () => 0,
          paddingBottom: () => 0,
        },
        margin: [0, 6, 0, 8],
      });
    } else if (b.type === 'ul') {
      content.push({ ul: b.items.map((it) => ({ text: textOf(it), margin: [0, 1, 0, 1] })), margin: [8, 2, 0, 8] });
    } else if (b.type === 'ol') {
      content.push({ ol: b.items.map((it) => ({ text: textOf(it), margin: [0, 1, 0, 1] })), margin: [8, 2, 0, 8] });
    } else {
      content.push({ text: textOf(b.inlines), margin: [0, 2, 0, 8] });
    }
  }

  return {
    pageSize: 'A4',
    pageMargins: [56, 56, 56, 64],
    content,
    styles: {
      h1: { fontSize: 20, bold: true, margin: [0, 14, 0, 8] },
      h2: { fontSize: 16, bold: true, margin: [0, 12, 0, 6] },
      h3: { fontSize: 13, bold: true, margin: [0, 10, 0, 5] },
    },
    defaultStyle: { fontSize: 11, lineHeight: 1.3 },
    footer: (page, pages) => ({
      text: `${page} / ${pages}`,
      alignment: 'center',
      fontSize: 9,
      color: '#94a3b8',
      margin: [0, 24, 0, 0],
    }),
    info: { title: sermon.title },
  };
}

/** Descarcă predica ca fișier .pdf (browser). */
export function downloadPdf(sermon) {
  pdfMake.createPdf(sermonToPdfDef(sermon)).download(sermonFileSlug(sermon.title) + '.pdf');
}

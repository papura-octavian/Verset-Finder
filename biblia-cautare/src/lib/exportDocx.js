// Exportul .docx al unei predici: markdown (lib/mdBlocks) → document Word real.
// `sermonToDocx` e pur (rulează și în Node, pentru verificare/teste);
// `downloadDocx` e partea de browser (blob + ancoră, ca la .md).
// Stilurile urmăresc previzualizarea: titluri pe 3 niveluri, citatul cu bordură
// stângă + fundal amber (versetele inserate), liste reale, bold/italic.

import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  ShadingType,
  TextRun,
} from 'docx';
import { parseBlocks } from './mdBlocks.js';
import { sermonMarkdown, sermonFileSlug } from './sermons.js';

// Culorile citatului, ca în preview (Tailwind amber-300 / amber-50).
const QUOTE_BORDER = 'FCD34D';
const QUOTE_BG = 'FFFBEB';

const HEADINGS = { 1: HeadingLevel.HEADING_1, 2: HeadingLevel.HEADING_2, 3: HeadingLevel.HEADING_3 };

function runsOf(inlines) {
  return inlines.map((r) => new TextRun({ text: r.text, bold: r.bold, italics: r.italic }));
}

// Un rând de citat; bordura/fundalul sunt pe fiecare paragraf, iar spațierea
// exterioară doar la marginile blocului (ca paragrafele să stea lipite).
function quotePara(inlines, first, last) {
  return new Paragraph({
    children: runsOf(inlines),
    shading: { type: ShadingType.CLEAR, color: 'auto', fill: QUOTE_BG },
    border: { left: { style: BorderStyle.SINGLE, size: 24, color: QUOTE_BORDER } },
    indent: { left: 240 },
    spacing: { before: first ? 160 : 0, after: last ? 160 : 0, line: 300 },
  });
}

/** Documentul Word complet al unei predici (fără descărcare). */
export function sermonToDocx(sermon) {
  const children = [];
  let olInstance = 0; // instanță separată per listă → numerotarea repornește de la 1

  for (const b of parseBlocks(sermonMarkdown(sermon))) {
    if (b.type === 'h') {
      children.push(new Paragraph({ heading: HEADINGS[b.level], children: runsOf(b.inlines) }));
    } else if (b.type === 'quote') {
      b.paras.forEach((q, i) => children.push(quotePara(q, i === 0, i === b.paras.length - 1)));
    } else if (b.type === 'ul') {
      b.items.forEach((it) =>
        children.push(new Paragraph({ children: runsOf(it), bullet: { level: 0 }, spacing: { after: 60 } }))
      );
    } else if (b.type === 'ol') {
      olInstance++;
      b.items.forEach((it) =>
        children.push(
          new Paragraph({
            children: runsOf(it),
            numbering: { reference: 'lista-numerotata', level: 0, instance: olInstance },
            spacing: { after: 60 },
          })
        )
      );
    } else {
      children.push(new Paragraph({ children: runsOf(b.inlines), spacing: { after: 120 } }));
    }
  }

  return new Document({
    numbering: {
      config: [
        {
          reference: 'lista-numerotata',
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: '%1.',
              alignment: AlignmentType.START,
              style: { paragraph: { indent: { left: 720, hanging: 360 } } },
            },
          ],
        },
      ],
    },
    styles: {
      default: { document: { run: { font: 'Calibri', size: 24 } } }, // corp 12pt
      paragraphStyles: [
        {
          id: 'Heading1',
          name: 'Heading 1',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 40, bold: true, color: '111111' }, // 20pt
          paragraph: { spacing: { before: 280, after: 160 } },
        },
        {
          id: 'Heading2',
          name: 'Heading 2',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 32, bold: true, color: '111111' }, // 16pt
          paragraph: { spacing: { before: 240, after: 120 } },
        },
        {
          id: 'Heading3',
          name: 'Heading 3',
          basedOn: 'Normal',
          next: 'Normal',
          quickFormat: true,
          run: { size: 26, bold: true, color: '333333' }, // 13pt
          paragraph: { spacing: { before: 200, after: 100 } },
        },
      ],
    },
    sections: [{ properties: {}, children }],
  });
}

/** Descarcă predica ca fișier .docx (browser). */
export async function downloadDocx(sermon) {
  const blob = await Packer.toBlob(sermonToDocx(sermon));
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = sermonFileSlug(sermon.title) + '.docx';
  a.click();
  URL.revokeObjectURL(a.href);
}

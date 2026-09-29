import 'regenerator-runtime/runtime';
import { PDFDocument, rgb, type PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { Medicine } from './consult.dto';

const FONT_URLS = [
  'https://cdn.jsdelivr.net/gh/notofonts/notosansbengali@main/fonts/hinted/ttf/NotoSansBengali-Regular.ttf',
  'https://github.com/google/fonts/raw/main/ofl/notosansbengali/NotoSansBengali%5Bwdth%2Cwght%5D.ttf',
];

let cachedFont: Uint8Array | null = null;

async function bengaliFontBytes(): Promise<Uint8Array> {
  if (cachedFont) return cachedFont;
  let last = 'font';
  for (const url of FONT_URLS) {
    try {
      const res = await fetch(url);
      if (!res.ok) {
        last = `font ${res.status}`;
        continue;
      }
      cachedFont = new Uint8Array(await res.arrayBuffer());
      return cachedFont;
    } catch (err) {
      last = String(err);
    }
  }
  throw new Error(last);
}

const forest = rgb(0.106, 0.369, 0.29);
const ink = rgb(0.11, 0.169, 0.141);
const muted = rgb(0.357, 0.42, 0.392);

function wrap(text: string, font: PDFFont, size: number, max: number): string[] {
  const out: string[] = [];
  for (const para of text.split(/\n/)) {
    const words = para.split(/\s+/).filter(Boolean);
    let current = '';
    for (const word of words) {
      const next = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(next, size) <= max) {
        current = next;
        continue;
      }
      if (current) out.push(current);
      current = word;
    }
    if (current) out.push(current);
    if (!words.length) out.push('');
  }
  return out.length ? out : [''];
}

export async function buildConsultPdf(input: {
  farmerName: string;
  specialistName: string;
  problemText: string;
  summaryBn: string;
  steps: string;
  medicines: Medicine[];
}) {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await bengaliFontBytes());
  const pageSize: [number, number] = [595.28, 841.89];
  let page = pdf.addPage(pageSize);
  let y = 800;
  const margin = 48;
  const max = 595.28 - margin * 2;

  const draw = (text: string, size: number, color = ink, gap = 4) => {
    for (const line of wrap(text, font, size, max)) {
      if (y < 64) {
        page = pdf.addPage(pageSize);
        y = 800;
      }
      page.drawText(line, { x: margin, y, size, font, color });
      y -= size + gap;
    }
  };

  page.drawRectangle({ x: 0, y: 790, width: 595.28, height: 52, color: forest });
  page.drawText('আরণ্য — কৃষি পরামর্শ', {
    x: margin,
    y: 808,
    size: 16,
    font,
    color: rgb(1, 1, 1),
  });
  y = 760;
  draw(`কৃষক: ${input.farmerName}`, 12);
  draw(`বিশেষজ্ঞ: ${input.specialistName}`, 12, muted);
  y -= 8;
  draw('সমস্যা', 13, forest, 6);
  draw(input.problemText, 11);
  y -= 8;
  draw('পরামর্শ', 13, forest, 6);
  draw(input.summaryBn, 11);
  y -= 8;
  draw('করণীয়', 13, forest, 6);
  draw(input.steps, 11);
  y -= 8;
  draw('ওষুধ', 13, forest, 6);
  if (!input.medicines.length) draw('কোনো ওষুধ লেখা হয়নি।', 11, muted);
  for (const item of input.medicines) {
    draw(`${item.name} — ${item.dose}`, 12);
    draw(item.howToApply, 11, muted);
    y -= 4;
  }

  return Buffer.from(await pdf.save());
}

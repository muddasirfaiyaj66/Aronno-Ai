import 'regenerator-runtime/runtime';
import { PDFDocument, rgb, type PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';

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
const line = rgb(0.835, 0.867, 0.847);

function wrap(
  text: string,
  font: PDFFont,
  size: number,
  max: number,
): string[] {
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
      if (font.widthOfTextAtSize(word, size) <= max) {
        current = word;
        continue;
      }
      let chunk = '';
      for (const ch of [...word]) {
        const trial = chunk + ch;
        if (font.widthOfTextAtSize(trial, size) <= max) chunk = trial;
        else {
          if (chunk) out.push(chunk);
          chunk = ch;
        }
      }
      current = chunk;
    }
    if (current) out.push(current);
  }
  return out.length ? out : [''];
}

export type ReportPdfInput = {
  farmerName: string;
  cropNameBn: string;
  diseaseNameBn: string;
  diseaseNameEn: string;
  confidence: number;
  severity: string;
  pesticideNameBn: string;
  dosagePerBigha: string;
  followUpLabelBn: string;
  weatherReasonBn: string;
  steps: { step: number; instructionBn: string }[];
};

function severityBn(level: string) {
  if (level === 'high') return 'বেশি';
  if (level === 'low') return 'কম';
  return 'মাঝারি';
}

export async function buildReportPdf(input: ReportPdfInput): Promise<Buffer> {
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(await bengaliFontBytes());
  const page = pdf.addPage([595.28, 841.89]);
  const { width, height } = page.getSize();
  const left = 48;
  const max = width - 96;
  let y = height - 56;

  page.drawRectangle({
    x: 0,
    y: height - 92,
    width,
    height: 92,
    color: forest,
  });
  page.drawText('আরণ্য', {
    x: left,
    y: height - 48,
    size: 22,
    font,
    color: rgb(1, 1, 1),
  });
  page.drawText('ফসলের রোগ ও চিকিৎসা রিপোর্ট', {
    x: left,
    y: height - 72,
    size: 12,
    font,
    color: rgb(0.89, 0.937, 0.914),
  });
  y = height - 120;

  const date = new Intl.DateTimeFormat('bn-BD', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date());

  const blocks: { label: string; value: string }[] = [
    { label: 'কৃষক', value: input.farmerName || '—' },
    { label: 'তারিখ', value: date },
    { label: 'ফসল', value: input.cropNameBn },
    { label: 'রোগ', value: `${input.diseaseNameBn} (${input.diseaseNameEn})` },
    { label: 'নির্ভুলতা', value: `${Math.round(input.confidence)}%` },
    { label: 'তীব্রতা', value: severityBn(input.severity) },
    { label: 'কীটনাশক', value: input.pesticideNameBn },
    { label: 'মাত্রা', value: input.dosagePerBigha },
    { label: 'ফলো-আপ', value: input.followUpLabelBn },
    { label: 'আবহাওয়া', value: input.weatherReasonBn || '—' },
  ];

  for (const block of blocks) {
    page.drawText(block.label, { x: left, y, size: 10, font, color: muted });
    y -= 16;
    const lines = wrap(block.value, font, 13, max);
    for (const row of lines) {
      if (y < 72) break;
      page.drawText(row, { x: left, y, size: 13, font, color: ink });
      y -= 18;
    }
    y -= 6;
    page.drawLine({
      start: { x: left, y: y + 10 },
      end: { x: width - left, y: y + 10 },
      thickness: 0.6,
      color: line,
    });
    y -= 8;
  }

  if (input.steps.length && y > 100) {
    page.drawText('করণীয়', { x: left, y, size: 12, font, color: forest });
    y -= 20;
    for (const step of input.steps) {
      const lines = wrap(`${step.step}. ${step.instructionBn}`, font, 12, max);
      for (const row of lines) {
        if (y < 64) break;
        page.drawText(row, { x: left, y, size: 12, font, color: ink });
        y -= 16;
      }
      y -= 4;
    }
  }

  page.drawText('আরণ্য — ক্ষেতের সহজ সহচর', {
    x: left,
    y: 36,
    size: 9,
    font,
    color: muted,
  });

  return Buffer.from(await pdf.save());
}

import { File, Paths } from "expo-file-system";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import type { TreatmentPlan } from "@/types/treatment";

function bytesFromBase64(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function reportHtml(input: {
  farmerName?: string;
  dateLabel: string;
  diseaseNameBn: string;
  diseaseNameEn?: string;
  confidence?: string;
  severity?: string;
  plan: TreatmentPlan;
}) {
  const steps = input.plan.steps
    .map((s) => `<li>${escapeHtml(`${s.step}. ${s.instructionBn}`)}</li>`)
    .join("");
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <style>
      @page { margin: 28px; }
      body { font-family: "Noto Sans Bengali", "Nirmala UI", "Bangla Sangam MN", sans-serif; color: #1C2B24; }
      .banner { background: #1B5E4A; color: #fff; padding: 22px 20px; border-radius: 16px; }
      h1 { margin: 0; font-size: 26px; }
      .sub { margin-top: 6px; opacity: 0.9; }
      .row { margin-top: 16px; padding-bottom: 10px; border-bottom: 1px solid #D5DDD8; }
      .label { color: #5B6B64; font-size: 13px; }
      .value { font-size: 18px; font-weight: 700; margin-top: 4px; }
    </style>
  </head>
  <body>
    <div class="banner">
      <h1>আরণ্য</h1>
      <div class="sub">ফসলের রোগ ও চিকিৎসা রিপোর্ট</div>
    </div>
    <div class="row"><div class="label">কৃষক</div><div class="value">${escapeHtml(input.farmerName || "—")}</div></div>
    <div class="row"><div class="label">তারিখ</div><div class="value">${escapeHtml(input.dateLabel)}</div></div>
    <div class="row"><div class="label">ফসল</div><div class="value">${escapeHtml(input.plan.cropNameBn)}</div></div>
    <div class="row"><div class="label">রোগ</div><div class="value">${escapeHtml(input.diseaseNameBn)}${input.diseaseNameEn ? ` (${escapeHtml(input.diseaseNameEn)})` : ""}</div></div>
    <div class="row"><div class="label">নির্ভুলতা / তীব্রতা</div><div class="value">${escapeHtml(input.confidence || "—")}% · ${escapeHtml(input.severity || "—")}</div></div>
    <div class="row"><div class="label">কীটনাশক</div><div class="value">${escapeHtml(input.plan.pesticideNameBn)}</div></div>
    <div class="row"><div class="label">মাত্রা</div><div class="value">${escapeHtml(input.plan.dosagePerBigha)}</div></div>
    <div class="row"><div class="label">ফলো-আপ</div><div class="value">${escapeHtml(input.plan.followUpLabelBn)}</div></div>
    <div class="row"><div class="label">আবহাওয়া</div><div class="value">${escapeHtml(input.plan.weatherAdvisory.reasonBn || "—")}</div></div>
    ${steps ? `<h3>করণীয়</h3><ol>${steps}</ol>` : ""}
  </body>
</html>`;
}

export async function saveAndSharePdf(opts: {
  pdfBase64?: string | null;
  filename: string;
  htmlFallback: string;
}) {
  let uri: string | null = null;
  if (opts.pdfBase64 && opts.pdfBase64.length > 80) {
    const file = new File(Paths.cache, opts.filename);
    if (file.exists) file.delete();
    file.create();
    file.write(bytesFromBase64(opts.pdfBase64));
    uri = file.uri;
  }
  if (!uri) {
    const printed = await Print.printToFileAsync({ html: opts.htmlFallback });
    uri = printed.uri;
  }
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: "application/pdf",
      UTI: "com.adobe.pdf",
      dialogTitle: "রিপোর্ট সংরক্ষণ করুন",
    });
  }
  return uri;
}

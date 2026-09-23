/**
 * Deterministic answers for questions a small on-device model gets wrong:
 * greetings, time/date, weather, thanks, and knowledge-base (RAG) crop/disease
 * questions. Returns null when the LLM should answer instead.
 */
import kb from "@/assets/models/kb/bn_knowledge_base.json";
import {
  cachedWeather,
  currentUserFirstName,
  seasonTipBn,
  timeOfDayGreetingBn,
} from "@/lib/offlineNlu/retrieve";
import { recentDiagnoses } from "@/lib/offlineDb/queries";

type KbDisease = (typeof kb.diseases)[number];

export type ChatTopic = {
  crop?: CropKey;
  diseaseId?: string;
  askedForScan?: boolean;
};

export type IntentAnswer = { text: string; topic?: ChatTopic };

type CropKey = "tomato" | "potato" | "pepper";

const CROPS: Record<CropKey, { re: RegExp; nameBn: string; inBn: string; idPrefix: string }> = {
  tomato: { re: /টমেটো|tomato/i, nameBn: "টমেটো", inBn: "টমেটোতে", idPrefix: "tomato" },
  potato: { re: /আলু|potato/i, nameBn: "আলু", inBn: "আলুতে", idPrefix: "potato" },
  pepper: {
    re: /মরিচ|ক্যাপসিকাম|pepper|capsicum/i,
    nameBn: "মরিচ",
    inBn: "মরিচে",
    idPrefix: "pepper",
  },
};

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const toBn = (n: number | string) =>
  String(n).replace(/\d/g, (d) => BN_DIGITS[Number(d)]);

const WEEKDAYS = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];
const MONTHS = [
  "জানুয়ারি", "ফেব্রুয়ারি", "মার্চ", "এপ্রিল", "মে", "জুন",
  "জুলাই", "আগস্ট", "সেপ্টেম্বর", "অক্টোবর", "নভেম্বর", "ডিসেম্বর",
];

const RE = {
  greeting:
    /^(?:হ্যালো+|হেলো|হাই|hello|hi|hey|নমস্কার|আসসালামু\s*আলাইকুম|সালাম|শুভ\s*(?:সকাল|দুপুর|বিকেল|সন্ধ্যা|রাত্রি)|good\s*(?:morning|evening))(?:\s*আরণ্য)?[\s!?।.,]*$/i,
  howAreYou: /কেমন\s*আছ|কেমন\s*আছেন|কি\s*খবর|কী\s*খবর/i,
  time: /কয়টা\s*বাজে|কটা\s*বাজে|কয়টা\s*বাজছে|সময়\s*কত|এখন\s*কত\s*সময়|what\s*time/i,
  date: /তারিখ|আজ\s*(?:কী|কি)\s*বার|কোন\s*বার|কী\s*বার|কি\s*বার|date|day\s*today/i,
  rain: /বৃষ্টি|rain/i,
  temp: /তাপমাত্রা|টেম্প|টেম্পারেচার|ডিগ্রি|গরম\s*কত|ঠান্ডা\s*কত|temp/i,
  weather: /আবহাওয়া|আবহাওয়া|weather|রোদ|মেঘ|ঝড়/i,
  thanks: /ধন্যবাদ|থ্যাংক|thank/i,
  bye: /বিদায়|আল্লাহ\s*হাফেজ|খোদা\s*হাফেজ|bye|পরে\s*কথা\s*হবে/i,
  who: /তুমি\s*কে|আপনি\s*কে|তোমার\s*নাম|আপনার\s*নাম\s*কী|কী\s*করতে\s*পার/i,
  yes: /^(?:হ্যাঁ|হ্যা|জি|জ্বি|হুম|ঠিক\s*আছে|আচ্ছা|ok|okay|yes)[\s!?।.]*$/i,
  no: /^(?:না|নাহ|না\s*তো|no)[\s!?।.]*$/i,
  treatAsk: /চিকিৎসা|কী\s*করব|কি\s*করব|করণীয়|ওষুধ|কীটনাশক|স্প্রে|প্রতিকার|সমাধান/i,
  preventAsk: /প্রতিরোধ|কিভাবে\s*ঠেকা|যাতে\s*না\s*হয়/i,
  diseaseAsk: /রোগ|দাগ|হলুদ|পচ|শুকি|কুঁকড়|কোঁকড়|পোকা|সমস্যা|কী\s*হয়েছে|কি\s*হয়েছে|ধ্বসা|ব্লাইট|ছত্রাক/i,
};

function norm(s: string) {
  return s.toLowerCase().replace(/[।,.!?"'«»:;()\-–—]/g, " ").replace(/\s+/g, " ").trim();
}

function firstClause(s: string) {
  return s.split(/[;।]/)[0]?.trim() ?? s;
}

function shortDiseaseName(d: KbDisease) {
  return d.diseaseNameBn
    .replace(/\(.*?\)/g, "")
    .replace(/^(?:টমেটোর|আলুর|ক্যাপসিকাম\/মরিচের|মরিচের)\s*/, "")
    .replace(/\s*রোগ$/, "")
    .trim();
}

function diseasesForCrop(crop: CropKey) {
  return kb.diseases.filter(
    (d) => d.id.toLowerCase().startsWith(CROPS[crop].idPrefix) && !/healthy/i.test(d.id),
  );
}

function detectCrop(text: string): CropKey | undefined {
  return (Object.keys(CROPS) as CropKey[]).find((k) => CROPS[k].re.test(text));
}

function findNamedDisease(text: string): KbDisease | undefined {
  const t = norm(text);
  return kb.diseases.find((d) => {
    if (/healthy/i.test(d.id)) return false;
    const key = norm(shortDiseaseName(d));
    return (key.length >= 3 && t.includes(key)) || t.includes(norm(d.diseaseNameEn));
  });
}

function matchBySymptoms(text: string, crop?: CropKey): KbDisease | undefined {
  const words = norm(text).split(" ").filter((w) => w.length >= 2);
  const pool = crop ? diseasesForCrop(crop) : kb.diseases.filter((d) => !/healthy/i.test(d.id));
  let best: { d: KbDisease; score: number } | undefined;
  for (const d of pool) {
    const hay = norm(d.symptomsBn);
    const score = words.reduce((s, w) => (hay.includes(w) ? s + (w.length >= 4 ? 2 : 1) : s), 0);
    if (!best || score > best.score) best = { d, score };
  }
  return best && best.score >= 4 ? best.d : undefined;
}

function diseaseAnswer(d: KbDisease, lead?: string): string {
  const name = d.diseaseNameBn.replace(/\s*\(.*?\)/g, "");
  return [
    lead ?? `${name}:`,
    `লক্ষণ হলো ${firstClause(d.symptomsBn)}।`,
    `এখনই করণীয়: ${firstClause(d.treatmentBn)}।`,
    `পরে যাতে না হয়: ${firstClause(d.preventionBn)}।`,
  ].join(" ");
}

function formatTimeBn(now: Date) {
  const h24 = now.getHours();
  const part =
    h24 < 4 ? "রাত" : h24 < 6 ? "ভোর" : h24 < 12 ? "সকাল" : h24 < 16 ? "দুপুর" : h24 < 18 ? "বিকেল" : h24 < 20 ? "সন্ধ্যা" : "রাত";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const m = now.getMinutes();
  return `${part} ${toBn(h12)}টা${m ? ` ${toBn(m)} মিনিট` : ""}`;
}

function weatherAnswer(text: string): string {
  const w = cachedWeather();
  if (!w) {
    return `এই মুহূর্তে লাইভ আবহাওয়া পাচ্ছি না — একবার ইন্টারনেট চালু করে হোম স্ক্রিন খুললে জানাতে পারব। ${seasonTipBn()}`;
  }
  const place = w.locationBn ? `${w.locationBn}-এ ` : "";
  const temp = `${toBn(Math.round(w.tempC))} ডিগ্রি সেলসিয়াস`;
  const rain = `${toBn(Math.round(w.precipProb))} শতাংশ`;
  const advice =
    w.precipProb >= 60
      ? "আজ স্প্রে না করাই ভালো, জমির নালা খোলা রাখুন।"
      : w.precipProb <= 25
        ? "স্প্রে বা সেচের জন্য দিনটা ভালো।"
        : "স্প্রে করলে সকালের দিকে সেরে নিন।";

  if (RE.rain.test(text) && !RE.temp.test(text)) {
    return `${place}এখন ${w.conditionBn}, বৃষ্টির সম্ভাবনা ${rain}। ${advice}`;
  }
  if (RE.temp.test(text) && !RE.rain.test(text)) {
    const heat = w.tempC >= 33 ? " গরম বেশি, দুপুরে সেচ বা স্প্রে এড়িয়ে চলুন।" : "";
    return `${place}এখন তাপমাত্রা প্রায় ${temp}, ${w.conditionBn}।${heat}`;
  }
  return `${place}এখন প্রায় ${temp}, ${w.conditionBn}। বৃষ্টির সম্ভাবনা ${rain}। ${advice}`;
}

async function cropAnswer(crop: CropKey, text: string): Promise<IntentAnswer> {
  const c = CROPS[crop];

  const bySymptom = matchBySymptoms(text, crop);
  if (bySymptom) {
    return {
      text: diseaseAnswer(
        bySymptom,
        `বর্ণনা অনুযায়ী ${bySymptom.diseaseNameBn.replace(/\s*\(.*?\)/g, "")} হতে পারে।`,
      ) + " নিশ্চিত হতে পাতার ছবি তুলে স্ক্যান করুন।",
      topic: { crop, diseaseId: bySymptom.id },
    };
  }

  const recent = await recentDiagnoses(3).catch(() => []);
  const hit = recent.find(
    (r) => r.labelId.toLowerCase().startsWith(c.idPrefix) && !/healthy/i.test(r.labelId),
  );
  if (hit) {
    const d = kb.diseases.find((x) => x.id === hit.labelId);
    const lead = `আপনার শেষ স্ক্যানে ${c.inBn} ${hit.diseaseNameBn.replace(/\s*\(.*?\)/g, "")} পাওয়া গেছে।`;
    return {
      text: d ? `${diseaseAnswer(d, lead)} নতুন লক্ষণ দেখলে আবার স্ক্যান করুন।` : `${lead} চিকিৎসা দেখতে ইতিহাসে যান।`,
      topic: { crop, diseaseId: hit.labelId },
    };
  }

  const common = diseasesForCrop(crop).slice(0, 3).map(shortDiseaseName);
  return {
    text: `${c.inBn} সাধারণত ${common.join(", ")} রোগ বেশি হয়। পাতায় কী দেখছেন — দাগ, হলুদ ভাব, নাকি কুঁকড়ে যাওয়া? পাতার একটা ছবি তুলে স্ক্যান করলে নিশ্চিত বলতে পারব।`,
    topic: { crop, askedForScan: true },
  };
}

export async function answerByIntent(
  userText: string,
  ctx: { topic?: ChatTopic; hasHistory: boolean },
): Promise<IntentAnswer | null> {
  const text = userText.trim();
  if (!text) return null;
  const name = currentUserFirstName();

  if (RE.greeting.test(text)) {
    return {
      text: ctx.hasHistory
        ? "বলুন — কী জানতে চান?"
        : `${timeOfDayGreetingBn()}${name ? `, ${name}` : ""}। ফসল, রোগ, সার বা আবহাওয়া নিয়ে জিজ্ঞাসা করুন।`,
    };
  }
  if (RE.howAreYou.test(text) && text.length < 30) {
    return {
      text: `ভালো আছি${name ? `, ${name}` : ""}। আপনার ফসলে কোনো সমস্যা আছে কি?`,
    };
  }
  if (RE.time.test(text)) {
    return { text: `এখন ${formatTimeBn(new Date())}।` };
  }
  if (RE.date.test(text) && text.length < 40) {
    const d = new Date();
    return {
      text: `আজ ${WEEKDAYS[d.getDay()]}, ${toBn(d.getDate())} ${MONTHS[d.getMonth()]} ${toBn(d.getFullYear())}।`,
    };
  }
  if (RE.thanks.test(text) && text.length < 40) {
    return { text: "সাহায্য করতে পেরে ভালো লাগল। আর কিছু জানতে চাইলে বলুন।" };
  }
  if (RE.bye.test(text) && text.length < 30) {
    return {
      text: `ভালো থাকুন${name ? `, ${name}` : ""}। প্রয়োজনে আবার কথা বলুন।`,
    };
  }
  if (RE.who.test(text) && text.length < 40) {
    return {
      text: "আমি আরণ্য — ফসলের রোগ চেনা, চিকিৎসা, আবহাওয়া ও চাষের পরামর্শ দিতে সাহায্য করি। ইন্টারনেট ছাড়াও কাজ করে।",
    };
  }
  if ((RE.rain.test(text) || RE.temp.test(text) || RE.weather.test(text)) && !RE.diseaseAsk.test(text)) {
    return { text: weatherAnswer(text) };
  }

  // Follow-ups that only make sense with the previous topic.
  const topicDisease = ctx.topic?.diseaseId
    ? kb.diseases.find((d) => d.id === ctx.topic?.diseaseId)
    : undefined;
  if (topicDisease && RE.treatAsk.test(text) && !detectCrop(text) && !findNamedDisease(text)) {
    return {
      text: `${topicDisease.diseaseNameBn.replace(/\s*\(.*?\)/g, "")}-এর চিকিৎসা: ${topicDisease.treatmentBn}`,
      topic: ctx.topic,
    };
  }
  if (topicDisease && RE.preventAsk.test(text) && !detectCrop(text)) {
    return { text: `প্রতিরোধের জন্য: ${topicDisease.preventionBn}`, topic: ctx.topic };
  }
  if (ctx.topic?.askedForScan && RE.yes.test(text)) {
    return {
      text: "নিচের ক্যামেরা বোতাম চাপুন। আক্রান্ত পাতার কাছ থেকে স্পষ্ট একটা ছবি তুলুন — স্ক্যান শেষে চিকিৎসা দেখাবে।",
      topic: { ...ctx.topic, askedForScan: false },
    };
  }
  if (ctx.topic?.askedForScan && RE.no.test(text)) {
    return {
      text: "পাতায় বা ফলে যা দেখছেন বলুন — রঙ, দাগের আকার বা পোকার নাম। নিশ্চিত না হলে ছবি তুলে স্ক্যান করুন।",
      topic: ctx.topic,
    };
  }

  // FAQ / fertilizer from knowledge base
  const faqHit = matchFaq(text);
  if (faqHit) {
    return { text: faqHit };
  }

  // Knowledge-base (RAG) answers.
  const named = findNamedDisease(text);
  if (named) {
    return {
      text: diseaseAnswer(named),
      topic: { crop: detectCrop(named.id), diseaseId: named.id },
    };
  }
  const crop = detectCrop(text);
  if (crop && RE.diseaseAsk.test(text)) {
    return cropAnswer(crop, text);
  }
  if (RE.diseaseAsk.test(text)) {
    const bySymptom = matchBySymptoms(text);
    if (bySymptom) {
      return {
        text:
          diseaseAnswer(
            bySymptom,
            `লক্ষণ অনুযায়ী ${bySymptom.diseaseNameBn.replace(/\s*\(.*?\)/g, "")} হতে পারে।`,
          ) + " কোন ফসল এবং পাতার ছবি পেলে আরও নিশ্চিত বলতে পারব।",
        topic: { diseaseId: bySymptom.id },
      };
    }
  }

  return null;
}

function matchFaq(text: string): string | null {
  const t = norm(text);
  let best: { score: number; response: string } | undefined;
  for (const f of kb.faq) {
    let score = 0;
    for (const p of f.patternsBn) {
      const pn = norm(p);
      if (!pn) continue;
      if (t.includes(pn) || pn.includes(t)) score += 12;
      else {
        const words = pn.split(" ").filter((w) => w.length >= 2);
        score += words.reduce((s, w) => (t.includes(w) ? s + 1 : s), 0);
      }
    }
    if (!best || score > best.score) {
      best = { score, response: f.responseBn };
    }
  }
  return best && best.score >= 6 ? best.response : null;
}

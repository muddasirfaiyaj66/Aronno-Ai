/**
 * RAG-lite: keyword + token retrieval over bn_knowledge_base.json,
 * plus session facts (profile, cached weather, season) for grounding.
 */
import kb from "@/assets/kb/bn_knowledge_base.json";
import { store } from "@/store";
import type { CurrentWeather } from "@/types/weather";

function normalize(s: string) {
  return s
    .toLowerCase()
    .replace(/[।,.!?"'«»:;\-–—()]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokens(s: string): string[] {
  return normalize(s)
    .split(" ")
    .filter((t) => t.length >= 2);
}

/**
 * Words in nearly every farming question. Scoring on them made "ধানের রোগ"
 * match pepper disease just because both mention রোগ/পাতা/দাগ.
 */
const STOPWORDS = new Set(
  (
    "রোগ রোগের রোগে পাতা পাতায় পাতার দাগ দাগের কী কি করব করবো করতে করণীয় হলে হয়েছে হয় হচ্ছে " +
    "আমার আমি আমাদের গাছ গাছে গাছের সমস্যা কেন কিভাবে কীভাবে কোন কোনো এখন দিন দেব দিব দিতে জন্য " +
    "আর ও এবং লাগছে লাগে দেখা যাচ্ছে বলুন বলো জানতে চাই ফসল ফসলের জমি জমিতে একটু খুব অনেক " +
    "প্রতিকার চিকিৎসা ওষুধ what how why the and my"
  ).split(" "),
);

/** Crops a farmer may name. `kbPrefix` = id prefix of that crop's entries in the KB. */
const CROP_WORDS: { key: string; nameBn: string; re: RegExp; kbPrefix?: string }[] = [
  { key: "rice", nameBn: "ধান", re: /ধান|আমন|আউশ|বোরো|\brice\b|paddy/i },
  { key: "wheat", nameBn: "গম", re: /(?:^|\s)গম(?:ের|ে)?(?:\s|$)|wheat/i },
  { key: "jute", nameBn: "পাট", re: /(?:^|\s)পাট(?:ের|ে)?(?:\s|$)|jute/i },
  { key: "maize", nameBn: "ভুট্টা", re: /ভুট্টা|maize|\bcorn\b/i },
  { key: "tomato", nameBn: "টমেটো", re: /টমেটো|tomato/i, kbPrefix: "tomato" },
  { key: "potato", nameBn: "আলু", re: /(?:^|\s)আলু|potato/i, kbPrefix: "potato" },
  { key: "pepper", nameBn: "মরিচ", re: /মরিচ|ক্যাপসিকাম|pepper|capsicum|chilli/i, kbPrefix: "pepper" },
  { key: "brinjal", nameBn: "বেগুন", re: /বেগুন|brinjal|eggplant/i },
  { key: "onion", nameBn: "পেঁয়াজ", re: /পেঁয়াজ|পিঁয়াজ|onion/i },
  { key: "garlic", nameBn: "রসুন", re: /রসুন|garlic/i },
  { key: "mustard", nameBn: "সরিষা", re: /সরিষা|সর্ষে|mustard/i },
  { key: "lentil", nameBn: "ডাল", re: /মসুর|ডাল\s*ফসল|lentil/i },
  { key: "banana", nameBn: "কলা", re: /(?:^|\s)কলা(?:র|য়)?(?:\s|$)|banana/i },
  { key: "mango", nameBn: "আম", re: /(?:^|\s)আম(?:ের|ে|গাছ)?(?:\s|$)|mango/i },
  { key: "gourd", nameBn: "লাউ-কুমড়া", re: /লাউ|কুমড়া|শসা|করলা|gourd|cucumber/i },
  { key: "cabbage", nameBn: "কপি", re: /কপি|cabbage|cauliflower/i },
];

export type CropMention = { key: string; nameBn: string; kbPrefix?: string };

/** The crop the farmer is asking about, if they named one. */
export function detectCropBn(text: string): CropMention | null {
  const hit = CROP_WORDS.find((c) => c.re.test(` ${text} `));
  return hit ? { key: hit.key, nameBn: hit.nameBn, kbPrefix: hit.kbPrefix } : null;
}

function diseaseCrop(id: string): string {
  return id.split("_")[0]?.toLowerCase() ?? "";
}

function queryTokens(query: string): string[] {
  return tokens(query).filter((t) => !STOPWORDS.has(t));
}

function overlapScore(query: string, haystack: string): number {
  const q = queryTokens(query);
  const hay = normalize(haystack);
  if (!q.length || !hay) return 0;
  let score = 0;
  for (const t of q) {
    if (hay.includes(t)) score += t.length >= 4 ? 2 : 1;
  }
  return score;
}

const WEATHER_HINTS =
  /বৃষ্টি|আবহাওয়া|তাপমাত্রা|টেম্প|টেম্পারেচার|গরম|ঠান্ডা|কুয়াশা|ঝড়|রৌদ্র|রদ|humidity|rain|weather|temp/i;

const TOOL_HINTS =
  /যন্ত্রপাতি|হাতিয়ার|কৃষি\s*যন্ত্র|মেশিন|টুল|কোদাল|নিদানি|বেলচা|স্প্রেয়ার|ঠেলা|ঝাঁঝরি|বালতি|রেক|দা\s*কাটারি/i;

const FERTILIZER_HINTS =
  /সার|ইউরিয়া|টিএসপি|ডিএপি|এমওপি|পটাশ|জিপসাম|কম্পোস্ট|গোবর|ফার্টিলাইজার/i;

const SEASON_BY_MONTH: { months: number[]; tip: string }[] = [
  {
    months: [3, 4, 5],
    tip: "এখন বাংলাদেশে গরমকাল — সেচ নিয়মিত রাখুন, দুপুরে স্প্রে এড়ান, ছায়া/মালচ সাহায্য করে।",
  },
  {
    months: [6, 7, 8, 9],
    tip: "এখন বর্ষাকাল — নিকাশ খোলা রাখুন, ছত্রাক রোগ বাড়ে; ভেজা পাতায় কাজ কমান।",
  },
  {
    months: [10, 11],
    tip: "এখন শরৎ/হেমন্ত — আমন ধান কাটা ও রবি ফসলের প্রস্তুতির সময়; আর্দ্রতা কমলে সেচ বাড়ান।",
  },
  {
    months: [12, 1, 2],
    tip: "এখন শীতকাল — কুয়াশা ও শিশিরে ছত্রাক হতে পারে; সকালে পাতা শুকাতে দিন, হিমে চারা ঢেকে রাখুন।",
  },
];

export function seasonTipBn(): string {
  const m = new Date().getMonth() + 1;
  return (
    SEASON_BY_MONTH.find((s) => s.months.includes(m))?.tip ??
    "স্থানীয় আবহাওয়া দেখে সেচ ও স্প্রে পরিকল্পনা করুন।"
  );
}

export function cachedWeather(): CurrentWeather | null {
  const queries = store.getState().api.queries;
  for (const entry of Object.values(queries)) {
    if (
      entry &&
      typeof entry === "object" &&
      "endpointName" in entry &&
      entry.endpointName === "getWeather" &&
      entry.status === "fulfilled" &&
      entry.data
    ) {
      return entry.data as CurrentWeather;
    }
  }
  return null;
}

/** Time-of-day greeting in Bangla (local device clock). */
export function timeOfDayGreetingBn(): string {
  const h = new Date().getHours();
  if (h >= 4 && h < 12) return "শুভ সকাল";
  if (h >= 12 && h < 16) return "শুভ দুপুর";
  if (h >= 16 && h < 19) return "শুভ বিকেল";
  return "শুভ সন্ধ্যা";
}

/** Profile facts — never inject greeting phrases (models copy them every turn). */
export function buildSessionFacts(
  opts: { includeWeather?: boolean } = {},
): string[] {
  const facts: string[] = [];
  const user = store.getState().auth.user;
  const first = user?.displayName?.trim().split(/\s+/)[0];
  if (first) facts.push(`ব্যবহারকারীর নাম: ${first}`);
  if (user?.district?.nameBn) facts.push(`জেলা: ${user.district.nameBn}`);

  if (opts.includeWeather) {
    const w = cachedWeather();
    if (w) {
      facts.push(
        `আবহাওয়া: ${w.tempC} ডিগ্রি, ${w.conditionBn}, বৃষ্টি ${w.precipProb}%`,
      );
    } else {
      facts.push(`লাইভ আবহাওয়া নেই। ${seasonTipBn()}`);
    }
  }

  return facts;
}

/** Short weather sentence for deterministic replies. */
export function weatherReplyBn(): string | null {
  const w = cachedWeather();
  if (!w) return null;
  return `এখন প্রায় ${w.tempC} ডিগ্রি, ${w.conditionBn}। বৃষ্টির সম্ভাবনা ${w.precipProb} শতাংশ।`;
}

const BN_DIGITS = "০১২৩৪৫৬৭৮৯";
const WEEKDAYS = [
  "রবিবার",
  "সোমবার",
  "মঙ্গলবার",
  "বুধবার",
  "বৃহস্পতিবার",
  "শুক্রবার",
  "শনিবার",
];
const MONTHS = [
  "জানুয়ারি",
  "ফেব্রুয়ারি",
  "মার্চ",
  "এপ্রিল",
  "মে",
  "জুন",
  "জুলাই",
  "আগস্ট",
  "সেপ্টেম্বর",
  "অক্টোবর",
  "নভেম্বর",
  "ডিসেম্বর",
];

function toBn(n: number | string) {
  return String(n).replace(/\d/g, (d) => BN_DIGITS[Number(d)] ?? d);
}

function formatClockBn(now: Date) {
  const h24 = now.getHours();
  const part =
    h24 < 4
      ? "রাত"
      : h24 < 6
        ? "ভোর"
        : h24 < 12
          ? "সকাল"
          : h24 < 16
            ? "দুপুর"
            : h24 < 18
              ? "বিকেল"
              : h24 < 20
                ? "সন্ধ্যা"
                : "রাত";
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const m = now.getMinutes();
  return `${part} ${toBn(h12)}টা${m ? ` ${toBn(m)} মিনিট` : ""}`;
}

function formatDateBn(now: Date) {
  return `${WEEKDAYS[now.getDay()]}, ${toBn(now.getDate())} ${MONTHS[now.getMonth()]} ${toBn(now.getFullYear())}`;
}

export type LiveSnapshot = {
  lines: string[];
  spokenTime: string;
  spokenDate: string;
  tempC: number | null;
  weatherSpoken: string | null;
};

const TIME_ASK =
  /কয়টা|কটা\s*বাজে|সময়\s*(?:কত|কী|কি|বলো)|what\s*time|current\s*time|koyta|kota\s*baj|somoy\s*kot/i;
const DATE_ASK =
  /তারিখ|কোন\s*বার|কী\s*বার|কি\s*বার|আজকের\s*(?:তারিখ|বার)|\bdate\b|what\s*(?:day|date)|ajker\s*tarikh/i;
const WEATHER_ASK =
  /আবহাওয়া|বৃষ্টি|তাপমাত্রা|টেম্প|গরম\s*কত|ঠান্ডা\s*কত|আর্দ্রতা|weather|forecast|humidity|temperature/i;
const ADVICE_ASK = /স্প্রে|সার|রোগ|কী\s*করব|কি\s*করব|চাষ|চিকিৎসা|সেচ/i;

/** Clock, profile, season, and cached weather — always safe to put in a prompt. */
export function liveSnapshot(now = new Date()): LiveSnapshot {
  const spokenTime = formatClockBn(now);
  const spokenDate = formatDateBn(now);
  const user = store.getState().auth.user;
  const first = user?.displayName?.trim().split(/\s+/)[0];
  const district = user?.district?.nameBn;
  const w = cachedWeather();
  const lines = [
    `এখন সময়: ${spokenTime}`,
    `আজকের তারিখ: ${spokenDate}`,
    `ঋতু: ${seasonTipBn()}`,
  ];
  if (first) lines.push(`কৃষকের নাম: ${first}`);
  if (district) lines.push(`জেলা: ${district}`);

  let weatherSpoken: string | null = null;
  if (w) {
    const place = w.locationBn || district || "আপনার এলাকা";
    const temp = toBn(Math.round(w.tempC));
    weatherSpoken = `${place} এ এখন ${temp} ডিগ্রি, ${w.conditionBn}। আর্দ্রতা ${toBn(Math.round(w.humidity))} শতাংশ, বৃষ্টির সম্ভাবনা ${toBn(Math.round(w.precipProb))} শতাংশ, বাতাস ${toBn(Math.round(w.windKph))} কিলোমিটার প্রতি ঘণ্টা।`;
    lines.push(
      `আবহাওয়া: ${place}; ${temp}°সে; ${w.conditionBn}; আর্দ্রতা ${toBn(Math.round(w.humidity))}%; বৃষ্টি ${toBn(Math.round(w.precipProb))}%; বৃষ্টিপাত ${w.precipitationMm} মিমি; বাতাস ${toBn(Math.round(w.windKph))} কিমি/ঘণ্টা`,
    );
  } else {
    lines.push("লাইভ আবহাওয়া এখনো লোড হয়নি। ডিগ্রি বা বৃষ্টির সংখ্যা বানাবেন না।");
  }

  return {
    lines,
    spokenTime,
    spokenDate,
    tempC: w ? Math.round(w.tempC) : null,
    weatherSpoken,
  };
}

/**
 * Pure clock / date / weather questions get the phone's data verbatim.
 * Mixed advice questions stay with the model, which still sees these lines.
 */
export function directLiveAnswer(
  question: string,
  live: LiveSnapshot,
): string | null {
  const q = question.trim();
  if (!q || q.length > 90 || ADVICE_ASK.test(q)) return null;
  const time = TIME_ASK.test(q);
  const date = DATE_ASK.test(q);
  const weather = WEATHER_ASK.test(q);
  if (weather && live.weatherSpoken && !time && !date) return live.weatherSpoken;
  if (time && date) return `আজ ${live.spokenDate}। এখন ${live.spokenTime}।`;
  if (time && !weather) return `এখন ${live.spokenTime}।`;
  if (date && !weather) return `আজ ${live.spokenDate}।`;
  if (weather && live.weatherSpoken) return live.weatherSpoken;
  return null;
}

/** Fill the weather cache when home has not loaded it yet. */
export async function ensureCachedWeather(): Promise<CurrentWeather | null> {
  const hit = cachedWeather();
  if (hit) return hit;
  try {
    const { fetchIsOnline } = await import("@/hooks/useIsOnline");
    if (!(await fetchIsOnline())) return null;
    const { api } = await import("@/services/api");
    const data = await Promise.race([
      store.dispatch(api.endpoints.getWeather.initiate(undefined)).unwrap(),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 2200)),
    ]);
    return data ?? cachedWeather();
  } catch {
    return cachedWeather();
  }
}

/** Current clock time in Bangla digits. */
export function timeReplyBn(): string {
  return `এখন ${formatClockBn(new Date())}।`;
}

/** First name of the logged-in user, if any — for reply sanitizing. */
export function currentUserFirstName(): string | null {
  const name = store.getState().auth.user?.displayName?.trim();
  if (!name) return null;
  return name.split(/\s+/)[0] ?? null;
}

type Scored = { score: number; text: string };

/** Returns short Bangla fact strings from the local knowledge base. */
export function retrieveContext(userTextBn: string, limit = 4): string[] {
  const text = normalize(userTextBn);
  const scored: Scored[] = [];
  const crop = detectCropBn(userTextBn);

  for (const d of kb.diseases) {
    if (/healthy/i.test(d.id)) continue;
    // Never hand the model another crop's disease: the KB only covers a few
    // crops, and for the rest Gemma should answer from its own knowledge.
    if (crop && crop.kbPrefix !== diseaseCrop(d.id)) continue;
    const hay = `${d.diseaseNameBn} ${d.diseaseNameEn} ${d.symptomsBn} ${d.id.replace(/_/g, " ")}`;
    let score = overlapScore(text, hay);
    const named =
      text.includes(normalize(d.diseaseNameBn)) || text.includes(normalize(d.diseaseNameEn));
    if (named) score += 10;
    // Same crop: a couple of symptom words is enough. No crop named: only a
    // clear disease-name or strong symptom match counts.
    if (score >= (crop ? 2 : 6)) {
      scored.push({
        score,
        text: `${d.diseaseNameBn}: লক্ষণ- ${d.symptomsBn}। চিকিৎসা- ${d.treatmentBn}। প্রতিরোধ- ${d.preventionBn}`,
      });
    }
  }

  for (const t of kb.tools) {
    const hay = `${t.toolNameBn} ${t.toolNameEn} ${t.usageBn}`;
    let score = overlapScore(text, hay);
    if (text.includes(normalize(t.toolNameBn)) || text.includes(normalize(t.toolNameEn))) {
      score += 8;
    }
    if (score >= 2) {
      scored.push({
        score,
        text: `${t.toolNameBn}: ${t.usageBn}`,
      });
    }
  }

  for (const f of kb.faq) {
    let score = 0;
    for (const p of f.patternsBn) {
      const pn = normalize(p);
      if (text.includes(pn) || pn.includes(text)) score += 12;
      else score += overlapScore(text, p);
    }
    if (score >= 2) {
      scored.push({ score, text: f.responseBn });
    }
  }

  if (WEATHER_HINTS.test(userTextBn)) {
    scored.push({ score: 6, text: seasonTipBn() });
    const w = cachedWeather();
    if (w) {
      scored.push({
        score: 15,
        text: `বর্তমান আবহাওয়া ব্যবহার করুন: ${w.tempC}°সে, ${w.conditionBn}, বৃষ্টি সম্ভাবনা ${w.precipProb}%. এই সংখ্যাগুলোই উত্তরে বলুন।`,
      });
    } else {
      scored.push({
        score: 8,
        text: "লাইভ তাপমাত্রা/বৃষ্টির সংখ্যা এখন জানা নেই। অনুমান করে ডিগ্রি বলবেন না — ঋতুভিত্তিক পরামর্শ দিন এবং হোম থেকে আবহাওয়া দেখতে বলুন।",
      });
    }
  }

  if (TOOL_HINTS.test(userTextBn)) {
    const catalog = kb.tools
      .map((t) => `${t.toolNameBn}: ${t.usageBn}`)
      .join(" ");
    scored.push({
      score: 14,
      text:
        ( /ধান|আমন|বোরো/.test(userTextBn)
          ? "ধান চাষে কোদাল/নিদানি, বেলচা, সেচের ঝাঁঝরি/বালতি, স্প্রেয়ার ও ঠেলাগাড়ি সাধারণত লাগে। "
          : "চাষাবাদে সাধারণ কৃষি হাতিয়ার: ") + catalog,
    });
  }

  if (FERTILIZER_HINTS.test(userTextBn)) {
    let fertText =
      "সার দেওয়ার সাধারণ নিয়ম: সুষম সার ব্যবহার করুন। জমি তৈরির সময় জৈব সার ও টিএসপি দিন; ইউরিয়া ও পটাশ গাছের বৃদ্ধির বিভিন্ন ধাপে ভাগ করে উপরিপ্রয়োগ করুন।";
    if (/টমেটো/i.test(userTextBn)) {
      fertText =
        "টমেটোর সার প্রয়োগ: জমি তৈরির সময় গোবর/কম্পোস্ট, টিএসপি, অর্ধেক এমওপি ও জিপসাম দিন। বাকি ইউরিয়া ও এমওপি চারা রোপণের ১৫, ৩০ ও ৪৫ দিন পর ৩ কিস্তিতে উপরিপ্রয়োগ করুন।";
    } else if (/আলু/i.test(userTextBn)) {
      fertText =
        "আলুর সার প্রয়োগ: শেষ চাষের সময় সব জৈব সার, টিএসপি, জিপসাম, অর্ধেক এমওপি ও অর্ধেক ইউরিয়া দিন। বাকি অর্ধেক ইউরিয়া ও এমওপি ২৫-৩০ দিন পর গাছে মাটি তোলার সময় দিন।";
    } else if (/মরিচ/i.test(userTextBn)) {
      fertText =
        "মরিচের সার প্রয়োগ: জমি তৈরির সময় গোবর, টিএসপি ও জিপসাম দিন। চারা লাগানোর ২৫ ও ৫০ দিন পর ইউরিয়া ও পটাশ সার দুই কিস্তিতে উপরিপ্রয়োগ করুন।";
    } else if (/ধান/i.test(userTextBn)) {
      fertText =
        "ধানের সার প্রয়োগ: জমি তৈরিতে টিএসপি/ডিএপি, জিপসাম, জিংক ও অর্ধেক এমওপি দিন। ইউরিয়া সমান ৩ কিস্তিতে (কুশি অবস্থায়, ৩০ দিন পর এবং কাইচ থোড় আসার আগে) দিন।";
    }
    scored.push({ score: 14, text: fertText });
  }

  scored.sort((a, b) => b.score - a.score);
  const unique: string[] = [];
  for (const s of scored) {
    if (!unique.includes(s.text)) unique.push(s.text);
    if (unique.length >= limit) break;
  }
  return unique;
}

/** Build grounding block from a vision label (disease/tool id) after offline scan. */
export function retrieveContextForLabel(
  kind: "disease" | "tool",
  idOrName: string,
): string[] {
  const key = normalize(idOrName);
  if (kind === "disease") {
    const d = kb.diseases.find(
      (x) =>
        normalize(x.id) === key ||
        normalize(x.diseaseNameEn) === key ||
        normalize(x.diseaseNameBn) === key,
    );
    if (!d) return [];
    return [
      `${d.diseaseNameBn} (${d.diseaseNameEn}): লক্ষণ- ${d.symptomsBn}। চিকিৎসা- ${d.treatmentBn}। প্রতিরোধ- ${d.preventionBn}`,
    ];
  }
  const t = kb.tools.find(
    (x) =>
      normalize(x.id) === key ||
      normalize(x.toolNameEn) === key ||
      normalize(x.toolNameBn) === key,
  );
  if (!t) return [];
  return [`${t.toolNameBn} (${t.toolNameEn}): ${t.usageBn}`];
}

/** Short spoken welcome — time + name, never profession. */
export function buildWelcomeBn(): string {
  const greet = timeOfDayGreetingBn();
  const name = currentUserFirstName();
  const district = store.getState().auth.user?.district?.nameBn;
  const w = cachedWeather();

  let msg = name ? `${greet}, ${name}।` : `${greet}।`;
  if (district) msg += ` ${district} এলাকায় সাহায্য করতে প্রস্তুত।`;
  if (w) msg += ` এখন প্রায় ${w.tempC} ডিগ্রি, ${w.conditionBn}।`;
  msg += " ফসল বা আবহাওয়া নিয়ে জিজ্ঞাসা করুন।";
  return msg;
}

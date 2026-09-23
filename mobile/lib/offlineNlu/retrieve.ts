/**
 * RAG-lite: keyword + token retrieval over bn_knowledge_base.json,
 * plus session facts (profile, cached weather, season) for grounding.
 */
import kb from "@/assets/models/kb/bn_knowledge_base.json";
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

function overlapScore(query: string, haystack: string): number {
  const q = tokens(query);
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
  /যন্ত্রপাতি|হাতিয়ার|কৃষি\s*যন্ত্র|মেশিন|টুল|কোদাল|নিদানি|বেলচা|স্প্রেয়ার|ঠেলা|ঝাঁঝরি|বালতি|রেক|দা\s*কাটারি|চাষ/i;

const FARM_HINTS =
  /ফসল|কৃষি|সার|সেচ|ধান|আমন|বোরো|টমেটো|আলু|মরিচ|চাষ|জমি|বীজ|রোপণ/i;

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

/** Current clock time in Bangla digits. */
export function timeReplyBn(): string {
  const now = new Date();
  const time = now.toLocaleTimeString("bn-BD", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
  return `এখন বেলা ${time}।`;
}

/** First name of the logged-in user, if any — for reply sanitizing. */
export function currentUserFirstName(): string | null {
  const name = store.getState().auth.user?.displayName?.trim();
  if (!name) return null;
  return name.split(/\s+/)[0] ?? null;
}

type Scored = { score: number; text: string };

/** Returns up to 4 short Bangla fact strings relevant to the user's message. */
export function retrieveContext(userTextBn: string): string[] {
  const text = normalize(userTextBn);
  const scored: Scored[] = [];

  for (const d of kb.diseases) {
    const hay = `${d.diseaseNameBn} ${d.diseaseNameEn} ${d.symptomsBn} ${d.id.replace(/_/g, " ")}`;
    let score = overlapScore(text, hay);
    // Strong boost for exact disease name hits
    if (text.includes(normalize(d.diseaseNameBn)) || text.includes(normalize(d.diseaseNameEn))) {
      score += 10;
    }
    if (score >= 2) {
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
  } else if (FARM_HINTS.test(userTextBn) && scored.length < 2) {
    scored.push({ score: 5, text: seasonTipBn() });
  }

  scored.sort((a, b) => b.score - a.score);
  const unique: string[] = [];
  for (const s of scored) {
    if (!unique.includes(s.text)) unique.push(s.text);
    if (unique.length >= 4) break;
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

/**
 * Pure text cleanup for assistant bubbles — no native / DB imports.
 * Kept separate so the chat tab can render without loading llama/sherpa.
 */
import { currentUserFirstName } from "@/lib/offlineNlu/retrieve";

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Strip greeting spam and identity leaks from model output. */
export function sanitizeAssistantReply(
  text: string,
  opts: { allowGreeting?: boolean } = {},
): string {
  const userName = currentUserFirstName();
  let out = text
    .replace(
      /^(?:\s*(?:কৃষক|আরণ্য|সহকারী|assistant|user|model|farmer|উত্তর)\s*[:：\-–—]\s*)+/gim,
      "",
    )
    .replace(
      /\n\s*(?:কৃষক|আরণ্য|সহকারী|assistant|user|model)\s*[:：\-–—]\s*/g,
      "\n",
    )
    .replace(/<\/?[^>]+>/g, "")
    .replace(/এই বিষয়ে নিশ্চিত তথ্য নেই[।.!?]?\s*/gi, "এই বিষয়ে নিশ্চিত তথ্য নেই। ");

  if (!opts.allowGreeting) {
    out = out.replace(
      /^(?:শুভ\s*(?:সকাল|দুপুর|বিকেল|সন্ধ্যা)|নমস্কার|হ্যালো)[^।.!?\n]{0,40}(?:আমি\s*আরণ্য[^।.!?\n]{0,40})?[।.!?]?\s*/i,
      "",
    );
    out = out.replace(
      /আমি\s*আরণ্য[।.!?]?\s*(?:কী\s*(?:জানতে\s*চান|সাহায্য\s*করব)[?؟।.!?]?\s*)?/gi,
      "",
    );
  }

  out = out.replace(/\s*\(?(?:এটা\s+)?তোমার\s+(?:নাম|পেশা)\s*নয়\)?/gi, "");
  out = out.replace(/সকালটা\s*ভালোই[।.!?]?\s*/gi, "");
  out = out.replace(/আনন্দিত হচ্ছে[।.!?]?\s*/gi, "");

  if (userName) {
    out = out.replace(
      /(?:আপনার|তোমার)?\s*নাম\s*(?:কী|কি|জানতে\s*চাই|বলুন|বলো)[?؟।.!?]?\s*/gi,
      "",
    );
    const n = escapeRegExp(userName);
    out = out.replace(
      new RegExp(`আমি\\s+${n}\\b[^.।!?\\n]{0,30}[।.!?]?`, "gi"),
      "",
    );
  }

  out = out.replace(
    /(?:হ্যালো|নমস্কার)?[,،]?\s*আমার\s+নাম\s+[^.।!?\n]{1,40}[।.!?]?/gi,
    "",
  );

  return out.replace(/\s{2,}/g, " ").replace(/\s+([।!?])/g, "$1").trim();
}

/**
 * Ground the online assistant in this farmer's app data.
 * Numbers come from the local scan database and the signed-in API.
 * Account numbers, phone, and email are never included.
 */
import { store } from "@/store";
import { recentDiagnoses } from "@/lib/offlineDb/queries";

const STATUS_BN: Record<string, string> = {
  pending: "অপেক্ষমাণ",
  confirmed: "নিশ্চিত",
  processing: "প্রস্তুত হচ্ছে",
  shipped: "পাঠানো হয়েছে",
  delivered: "পৌঁছেছে",
  cancelled: "বাতিল",
  paid: "পরিশোধিত",
  failed: "ব্যর্থ",
  unpaid: "বাকি",
};

function statusBn(value: unknown) {
  const key = String(value ?? "").toLowerCase();
  return STATUS_BN[key] ?? (key || "অজানা");
}

/** Account data only matters for questions about it — skip 7 API calls otherwise. */
const ACCOUNT_RE =
  /অর্ডার|order|ওয়ালেট|wallet|টাকা|আয়|খরচ|কার্ট|cart|দোকান|shop|পণ্য|product|বিজ্ঞপ্তি|নোটিফিকেশন|notification|পেমেন্ট|payment|বিক্রি|কেনা|ডেলিভারি|delivery/i;
const PLAN_RE = /পরিকল্পনা|plan|কোন\s*ফসল|কী\s*চাষ|মৌসুম|season/i;

/** A reply should never wait long on app data; the model answers without it. */
const FACT_BUDGET_MS = 900;
/** Re-use fetched account data for a minute (a chat is many quick turns). */
const CACHE_MS = 60_000;
const cache = new Map<string, { at: number; data: unknown }>();

function within<T>(work: Promise<T>, ms = FACT_BUDGET_MS): Promise<T | null> {
  return Promise.race([
    work.catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

/**
 * One RTK Query read with a short cache. Always unsubscribes, so chat turns
 * don't pile up cache subscriptions (the old code leaked one per call).
 */
async function fetchOnce<T>(name: string, start: () => {
  unwrap: () => Promise<T>;
  unsubscribe: () => void;
}): Promise<T | null> {
  const hit = cache.get(name);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.data as T;
  const request = start();
  try {
    const data = await request.unwrap();
    cache.set(name, { at: Date.now(), data });
    return data;
  } finally {
    request.unsubscribe();
  }
}

function money(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return `${Math.round(n)} টাকা`;
}

/** Start fetching account data early (chat screen open), so the first reply doesn't wait. */
export function warmAppFacts(): void {
  void gatherAppFacts("অর্ডার পরিকল্পনা", 4000).catch(() => undefined);
}

/**
 * Facts about this farmer for the prompt. Only pulls account data when the
 * question is about it, and never waits more than `budgetMs` for the network.
 */
export async function gatherAppFacts(
  question = "",
  budgetMs = FACT_BUDGET_MS,
): Promise<string[]> {
  const wantAccount = ACCOUNT_RE.test(question);
  const wantPlan = PLAN_RE.test(question);
  const user = store.getState().auth.user;
  const facts: string[] = [];
  if (user) {
    const bits = [
      user.displayName ? `নাম ${user.displayName}` : "",
      user.district?.nameBn ? `জেলা ${user.district.nameBn}` : "",
      user.profession?.nameBn ? `পেশা ${user.profession.nameBn}` : "",
    ].filter(Boolean);
    if (bits.length) facts.push(`প্রোফাইল: ${bits.join(", ")}।`);
  }

  const { api } = await import("@/services/api");
  const e = api.endpoints;
  const account = <T,>(name: string, start: Parameters<typeof fetchOnce<T>>[1]) =>
    wantAccount && user ? within(fetchOnce<T>(name, start), budgetMs) : Promise.resolve(null);

  const [scans, orders, shopOrders, wallet, cart, notes, shop, products, plan, tools] =
    await Promise.all([
      recentDiagnoses(3).catch(() => []),
      account("orders", () => store.dispatch(e.getBuyerOrders.initiate())),
      account("shopOrders", () => store.dispatch(e.getShopOrders.initiate())),
      account("wallet", () => store.dispatch(e.getWallet.initiate())),
      account("cart", () => store.dispatch(e.getCart.initiate())),
      account("notes", () => store.dispatch(e.getNotifications.initiate())),
      account("shop", () => store.dispatch(e.getMyShop.initiate())),
      account("products", () => store.dispatch(e.getMyProducts.initiate())),
      wantPlan && user
        ? within(
            fetchOnce("plan", () => store.dispatch(e.getLatestCropPlan.initiate())),
            budgetMs,
          )
        : Promise.resolve(null),
      recentTools().catch(() => [] as string[]),
    ]);

  if (scans.length) {
    facts.push(
      "সাম্প্রতিক রোগ স্ক্যান: " +
        scans
          .map(
            (row) =>
              `${row.diseaseNameBn} (${Math.round(row.confidence)}%), ${row.createdAt.slice(0, 10)}`,
          )
          .join("; ") +
        "।",
    );
  }

  const orderRows = Array.isArray(orders) ? orders.slice(0, 3) : [];
  if (orderRows.length) {
    facts.push(
      "ক্রেতার অর্ডার: " +
        orderRows
          .map((row) => {
            const order = row as {
              orderNumber?: string;
              status?: string;
              paymentStatus?: string;
              totalBdt?: number;
            };
            const total = money(order.totalBdt);
            return `${order.orderNumber ?? "অর্ডার"} ${statusBn(order.status)}${total ? `, ${total}` : ""}, পেমেন্ট ${statusBn(order.paymentStatus)}`;
          })
          .join("; ") +
        "।",
    );
  } else if (orders) {
    facts.push("ক্রেতার কোনো অর্ডার নেই।");
  }

  const shopOrderRows = Array.isArray(shopOrders) ? shopOrders.slice(0, 3) : [];
  if (shopOrderRows.length) {
    facts.push(
      "দোকানের অর্ডার: " +
        shopOrderRows
          .map((row) => {
            const order = row as {
              orderNumber?: string;
              status?: string;
              totalBdt?: number;
              buyer?: { displayName?: string };
            };
            const total = money(order.totalBdt);
            const buyer = order.buyer?.displayName
              ? `, ক্রেতা ${order.buyer.displayName}`
              : "";
            return `${order.orderNumber ?? "অর্ডার"} ${statusBn(order.status)}${total ? `, ${total}` : ""}${buyer}`;
          })
          .join("; ") +
        "।",
    );
  }

  if (wallet) {
    const spent = money(wallet.spentBdt);
    const earned = money(wallet.earnedBdt);
    const available = money(wallet.availableBdt);
    facts.push(
      `ওয়ালেট: খরচ ${spent ?? "০"}, আয় ${earned ?? "০"}, তুলতে পারবেন ${available ?? "০"}${wallet.shop?.name ? `, দোকান ${wallet.shop.name}` : ""}।`,
    );
  }

  if (cart && Array.isArray(cart.items)) {
    const total = money(cart.totalBdt);
    facts.push(
      cart.items.length
        ? `কার্টে ${cart.items.length}টি পণ্য${total ? `, মোট ${total}` : ""}।`
        : "কার্ট খালি।",
    );
  }

  if (Array.isArray(notes)) {
    const unread = notes.filter((item) => !item.read && !item.dismissed);
    const latest = notes[0];
    facts.push(
      unread.length
        ? `অপঠিত বিজ্ঞপ্তি ${unread.length}টি। সর্বশেষ: ${latest?.title ?? ""}।`
        : "নতুন বিজ্ঞপ্তি নেই।",
    );
  }

  if (shop && shop.name) {
    const count = Array.isArray(products) ? products.length : null;
    facts.push(
      `নিজের দোকান: ${shop.name}${shop.district?.nameBn ? `, ${shop.district.nameBn}` : ""}${count != null ? `, পণ্য ${count}টি` : ""}।`,
    );
  }

  if (plan?.recommendationBn) {
    const crop = plan.months?.[0]?.recommendedCropBn;
    facts.push(
      `ফসল পরিকল্পনা${crop ? ` (${crop})` : ""}: ${plan.recommendationBn.replace(/\s+/g, " ").slice(0, 180)}`,
    );
  }

  if (tools.length) facts.push(tools[0]);
  return facts;
}

async function recentTools(): Promise<string[]> {
  const { getOfflineDb } = await import("@/lib/offlineDb/db");
  const db = await getOfflineDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT tool_name_bn, reason_bn FROM local_tools ORDER BY created_at DESC LIMIT 2`,
  );
  if (!rows.length) return [];
  return [
    "সাম্প্রতিক যন্ত্র স্ক্যান: " +
      rows
        .map((row) => {
          const name = String(row.tool_name_bn ?? "");
          const why = row.reason_bn ? ` — ${String(row.reason_bn)}` : "";
          return `${name}${why}`;
        })
        .join("; ") +
      "।",
  ];
}

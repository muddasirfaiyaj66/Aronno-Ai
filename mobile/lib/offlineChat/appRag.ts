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

function within<T>(work: Promise<T>, ms = 1800): Promise<T | null> {
  return Promise.race([
    work.catch(() => null),
    new Promise<null>((resolve) => setTimeout(() => resolve(null), ms)),
  ]);
}

function money(value: unknown) {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  return `${Math.round(n)} টাকা`;
}

export async function gatherAppFacts(): Promise<string[]> {
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

  const [scans, orders, shopOrders, wallet, cart, notes, shop, products, plan, tools] =
    await Promise.all([
      recentDiagnoses(3).catch(() => []),
      within(
        store.dispatch(api.endpoints.getBuyerOrders.initiate()).unwrap(),
      ),
      within(
        store.dispatch(api.endpoints.getShopOrders.initiate()).unwrap(),
      ),
      within(store.dispatch(api.endpoints.getWallet.initiate()).unwrap()),
      within(store.dispatch(api.endpoints.getCart.initiate()).unwrap()),
      within(
        store.dispatch(api.endpoints.getNotifications.initiate()).unwrap(),
      ),
      within(store.dispatch(api.endpoints.getMyShop.initiate()).unwrap()),
      within(store.dispatch(api.endpoints.getMyProducts.initiate()).unwrap()),
      within(
        store.dispatch(api.endpoints.getLatestCropPlan.initiate()).unwrap(),
      ),
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

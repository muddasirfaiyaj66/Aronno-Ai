import type { AuthUser } from "./types";

type Envelope<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

export class ApiError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.code = code;
  }
}

function unwrap<T>(raw: unknown): T {
  if (raw && typeof raw === "object" && "success" in raw) {
    const env = raw as Envelope<T>;
    if (env.success) return env.data;
    throw new ApiError(env.error.message, env.error.code);
  }
  return raw as T;
}

/** Browser → same-origin BFF (`/api/...`) which proxies to Nest. */
export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const url = path.startsWith("/api") ? path : `/api${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const res = await fetch(url, {
    ...init,
    credentials: "include",
    headers,
  });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { success: false, error: { message: text || res.statusText } };
  }
  if (!res.ok) {
    const err = json as Envelope<never> | null;
    const message =
      err && !err.success
        ? err.error.message
        : `অনুরোধ ব্যর্থ (${res.status})`;
    const code = err && !err.success ? err.error.code : undefined;
    throw new ApiError(message, code);
  }
  return unwrap<T>(json);
}

export async function login(email: string, password: string) {
  return apiFetch<AuthUser>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
}

export async function logout() {
  return apiFetch<{ ok: boolean }>("/api/auth/logout", { method: "POST" });
}

export async function getMe() {
  return apiFetch<AuthUser>("/api/auth/me");
}

export async function listUsers(cursor?: string) {
  const q = cursor ? `?cursor=${encodeURIComponent(cursor)}&limit=50` : "?limit=50";
  return apiFetch<AuthUser[]>(`/api/admin/users${q}`);
}

export async function createAdmin(input: {
  email: string;
  password: string;
  displayName: string;
}) {
  return apiFetch<AuthUser>("/api/admin/users", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export async function patchUserActive(id: string, isActive: boolean) {
  return apiFetch<AuthUser>(`/api/admin/users/${id}/active`, {
    method: "PATCH",
    body: JSON.stringify({ isActive }),
  });
}

export type BroadcastPriority = "normal" | "important" | "emergency";

export type AdminBroadcast = {
  id: string;
  title: string;
  body: string;
  priority: BroadcastPriority | string;
  audience: "all" | "user" | string;
  targetUserId?: string | null;
  recipientCount: number;
  createdAt: string;
};

export type AdminOverview = {
  users: { total: number; active: number; inactive: number; farmers: number; verified: number; unverified: number };
  diagnoses: number;
  shops: { total: number; active: number };
  products: { total: number; active: number };
  orders: { total: number; revenue: number; byStatus: Record<string, number> };
  reportsOpen: number;
  specialists: { pending: number; approved: number };
  pendingSpecialists: {
    id: string;
    displayName: string;
    email: string;
    profession: string;
    submittedAt: string | null;
  }[];
  roleBreakdown: { name: string; value: number }[];
  topDistricts: { name: string; value: number }[];
  weeklySignups: { label: string; count: number; revenue: number }[];
  weeklySales: { label: string; count: number; revenue: number }[];
  topShops: { id: string; name: string; orders: number; revenue: number }[];
  recentOrders: { id: string; orderNumber: string; shopName: string; totalBdt: number; status: string; createdAt: string }[];
};

export type AdminShopRow = {
  id: string;
  name: string;
  phone: string;
  isActive: boolean;
  district: string;
  ownerId: string;
  ownerName: string;
  ownerEmail: string;
  ownerActive: boolean;
  products: number;
  orders: number;
  revenue: number;
};

export type AdminOrderRow = {
  id: string;
  orderNumber: string;
  shopName: string;
  buyerName: string;
  totalBdt: number;
  status: string;
  createdAt: string;
};

export type SellerReportRow = {
  id: string;
  reason: string;
  details: string | null;
  status: string;
  action: string | null;
  createdAt: string;
  shop: { id: string; name: string; isActive: boolean } | null;
  reporter: { id: string; displayName: string; email: string } | null;
  seller: { id: string; displayName: string; email: string; isActive: boolean } | null;
};

export type HeatPlace = {
  slug: string;
  nameBn: string;
  level: string;
  caseCount: number;
  priority: BroadcastPriority;
  title: string;
  body: string;
};

export async function getOverview() {
  return apiFetch<AdminOverview>("/api/admin/overview");
}

export async function getCommerce() {
  return apiFetch<{ shops: AdminShopRow[]; orders: AdminOrderRow[] }>("/api/admin/commerce");
}

export async function setShopActive(id: string, isActive: boolean) {
  return apiFetch<{ id: string; isActive: boolean }>(`/api/admin/shops/${id}`, {
    method: "PATCH",
    body: JSON.stringify({ isActive }),
  });
}

export async function listReports() {
  return apiFetch<SellerReportRow[]>("/api/admin/reports");
}

export async function resolveReport(id: string, action: "dismiss" | "block_seller" | "hide_shop") {
  return apiFetch<{ id: string; status: string }>(`/api/admin/reports/${id}`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}

export async function listHeatPlaces() {
  return apiFetch<HeatPlace[]>("/api/admin/notifications/places");
}

export async function listBroadcasts() {
  return apiFetch<AdminBroadcast[]>("/api/admin/notifications");
}

export async function sendBroadcast(input: {
  title: string;
  body: string;
  priority: BroadcastPriority;
  audience: "all" | "user" | "district";
  userId?: string;
  districtSlug?: string;
}) {
  return apiFetch<AdminBroadcast>("/api/admin/notifications", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export type DeliveryRates = {
  id: string;
  sameCityBdt: number;
  otherCityBdt: number;
};

export type AdminPayout = {
  id: string;
  amountBdt: number;
  channel: string;
  accountName: string;
  accountNumber: string;
  bankName: string | null;
  status: string;
  createdAt: string;
  seller: { id: string; displayName: string; email: string } | null;
  shop: { id: string; name: string } | null;
};

export async function getDeliveryRates() {
  return apiFetch<DeliveryRates>("/api/admin/delivery");
}

export async function setDeliveryRates(sameCityBdt: number, otherCityBdt: number) {
  return apiFetch<DeliveryRates>("/api/admin/delivery", {
    method: "PATCH",
    body: JSON.stringify({ sameCityBdt, otherCityBdt }),
  });
}

export async function listPayouts() {
  return apiFetch<AdminPayout[]>("/api/admin/payouts");
}

export async function resolvePayout(id: string, action: "paid" | "rejected") {
  return apiFetch<{ id: string; status: string }>(`/api/admin/payouts/${id}`, {
    method: "POST",
    body: JSON.stringify({ action }),
  });
}

export async function reviewSpecialist(
  id: string,
  decision: "approve" | "reject",
  note?: string,
) {
  return apiFetch<AuthUser>(`/api/admin/users/${id}/specialist`, {
    method: "PATCH",
    body: JSON.stringify({ decision, note }),
  });
}

export async function patchUserRole(
  id: string,
  roleSlug: "SUPERADMIN" | "ADMIN" | "USER",
) {
  return apiFetch<AuthUser>(`/api/admin/users/${id}/role`, {
    method: "PATCH",
    body: JSON.stringify({ roleSlug }),
  });
}

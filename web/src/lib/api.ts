import type { AdminLoan, AuthUser, LoanStatus } from "./types";

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

export async function patchUserRole(
  id: string,
  roleSlug: "SUPERADMIN" | "ADMIN" | "USER",
) {
  return apiFetch<AuthUser>(`/api/admin/users/${id}/role`, {
    method: "PATCH",
    body: JSON.stringify({ roleSlug }),
  });
}

export async function listLoans(cursor?: string) {
  const q = cursor
    ? `?cursor=${encodeURIComponent(cursor)}&limit=50`
    : "?limit=50";
  return apiFetch<AdminLoan[]>(`/api/admin/loans${q}`);
}

export async function patchLoanStatus(id: string, status: LoanStatus) {
  return apiFetch<AdminLoan>(`/api/admin/loans/${id}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status }),
  });
}

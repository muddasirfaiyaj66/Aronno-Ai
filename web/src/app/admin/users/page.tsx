"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ApiError,
  getMe,
  listUsers,
  patchUserActive,
  patchUserRole,
} from "@/lib/api";
import type { AuthUser, UserRole } from "@/lib/types";

export default function AdminUsersPage() {
  const [me, setMe] = useState<AuthUser | null>(null);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<"all" | "USER" | "ADMIN" | "inactive">(
    "all",
  );
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const [self, rows] = await Promise.all([getMe(), listUsers()]);
    setMe(self);
    setUsers(rows);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await reload();
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Could not load users.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return users.filter((u) => {
      if (filter === "USER" && u.role.slug !== "USER") return false;
      if (
        filter === "ADMIN" &&
        u.role.slug !== "ADMIN" &&
        u.role.slug !== "SUPERADMIN"
      ) {
        return false;
      }
      if (filter === "inactive" && u.isActive) return false;
      if (!needle) return true;
      return (
        u.displayName.toLowerCase().includes(needle) ||
        u.email.toLowerCase().includes(needle) ||
        (u.phone ?? "").includes(needle) ||
        (u.district?.nameBn ?? "").includes(needle)
      );
    });
  }, [users, q, filter]);

  async function toggleActive(u: AuthUser) {
    setBusyId(u.id);
    setError(null);
    try {
      const next = await patchUserActive(u.id, !u.isActive);
      setUsers((prev) => prev.map((row) => (row.id === u.id ? next : row)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not update the user.");
    } finally {
      setBusyId(null);
    }
  }

  async function changeRole(u: AuthUser, roleSlug: UserRole) {
    if (roleSlug === u.role.slug) return;
    setBusyId(u.id);
    setError(null);
    try {
      const next = await patchUserRole(u.id, roleSlug);
      setUsers((prev) => prev.map((row) => (row.id === u.id ? next : row)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not change the role.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <p className="text-muted">Loading users…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-ink">Users</h1>
        <p className="mt-1 text-muted">Accounts, roles, and whether someone can sign in.</p>
      </div>

      <div className="panel flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
        <input
          className="field max-w-md"
          placeholder="Search name, email, phone, or district"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <div className="flex flex-wrap gap-2">
          {(
            [
              ["all", "All"],
              ["USER", "Farmers"],
              ["ADMIN", "Admins"],
              ["inactive", "Blocked"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setFilter(id)}
              className={`rounded-xl px-3.5 py-2 text-sm font-semibold ${
                filter === id
                  ? "bg-forest text-white"
                  : "border border-border bg-[var(--white)] text-muted"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="sm:ml-auto text-sm text-muted">
          {filtered.length} / {users.length}
        </p>
      </div>

      {error ? (
        <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="panel overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-border bg-panel text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Name</th>
              <th className="px-4 py-3 font-semibold">Role</th>
              <th className="px-4 py-3 font-semibold">District</th>
              <th className="px-4 py-3 font-semibold">Email</th>
              <th className="px-4 py-3 font-semibold">Status</th>
              <th className="px-4 py-3 font-semibold">Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((u) => {
              const locked =
                u.role.slug === "SUPERADMIN" && me?.role.slug !== "SUPERADMIN";
              return (
                <tr
                  key={u.id}
                  className="border-b border-border last:border-0 hover:bg-panel/60"
                >
                  <td className="px-4 py-3">
                    <p className="font-semibold text-ink">{u.displayName}</p>
                    <p className="text-muted">{u.email}</p>
                    {u.phone ? (
                      <p className="text-xs text-muted">{u.phone}</p>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">
                    {me?.role.slug === "SUPERADMIN" && !locked ? (
                      <select
                        className="field !min-h-9 !py-1"
                        value={u.role.slug}
                        disabled={busyId === u.id}
                        onChange={(e) =>
                          void changeRole(u, e.target.value as UserRole)
                        }
                      >
                        <option value="USER">USER</option>
                        <option value="ADMIN">ADMIN</option>
                        <option value="SUPERADMIN">SUPERADMIN</option>
                      </select>
                    ) : (
                      <span className="rounded-lg bg-leaf/15 px-2.5 py-1 text-xs font-semibold text-forest">
                        {u.role.slug}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted">
                    {u.district?.nameBn ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                        u.emailVerifiedAt
                          ? "bg-leaf/20 text-forest"
                          : "bg-harvest/15 text-harvest"
                      }`}
                    >
                      {u.emailVerifiedAt ? "Verified" : "Unverified"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                        u.isActive
                          ? "bg-leaf/25 text-forest"
                          : "bg-danger/10 text-danger"
                      }`}
                    >
                      {u.isActive ? "Active" : "Blocked"}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <button
                      type="button"
                      disabled={locked || busyId === u.id || u.id === me?.id}
                      onClick={() => void toggleActive(u)}
                      className="btn btn-ghost !min-h-9 !px-3 text-xs"
                    >
                      {u.isActive ? "Block" : "Activate"}
                    </button>
                  </td>
                </tr>
              );
            })}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted">
                  No matches.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

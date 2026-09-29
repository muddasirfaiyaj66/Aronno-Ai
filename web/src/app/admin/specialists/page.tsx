"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, listUsers, reviewSpecialist } from "@/lib/api";
import type { AuthUser } from "@/lib/types";

const STATUS_LABEL = {
  none: "Not submitted",
  pending: "Waiting for review",
  approved: "Approved",
  rejected: "Rejected",
} as const;

function isSpecialistProfession(slug?: string) {
  return slug === "agronomist" || slug === "extension_officer";
}

export default function AdminSpecialistsPage() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});
  const [filter, setFilter] = useState<"pending" | "rejected" | "approved" | "all">("pending");

  const reload = useCallback(async () => {
    setUsers(await listUsers());
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await reload();
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load specialists.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [reload]);

  const rows = useMemo(() => {
    return users
      .filter((user) => {
        if (!isSpecialistProfession(user.profession?.slug)) return false;
        const status = user.specialistReviewStatus ?? "none";
        if (filter === "all") return status !== "none" || !!user.specialistCertificateUrl;
        return status === filter;
      })
      .sort((a, b) => (b.specialistSubmittedAt ?? "").localeCompare(a.specialistSubmittedAt ?? ""));
  }, [users, filter]);

  async function decide(user: AuthUser, decision: "approve" | "reject") {
    const note = notes[user.id]?.trim();
    if (decision === "reject" && (note?.length ?? 0) < 4) {
      setError("Write a short reason before rejecting.");
      return;
    }
    setBusyId(user.id);
    setError(null);
    try {
      const next = await reviewSpecialist(user.id, decision, note);
      setUsers((prev) => prev.map((row) => (row.id === user.id ? next : row)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save the review.");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p className="text-muted">Loading specialist reviews…</p>;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-[0.16em] text-forest uppercase">Access</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Specialist reviews</h1>
        <p className="mt-1 max-w-2xl text-muted">
          Check the certificate and national ID before approving. Approval opens the consult queue in the app.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["pending", "Waiting"],
            ["rejected", "Rejected"],
            ["approved", "Approved"],
            ["all", "All submitted"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`rounded-xl px-3.5 py-2 text-sm font-semibold ${
              filter === id ? "bg-forest text-white" : "border border-border bg-[var(--white)] text-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? <p className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">{error}</p> : null}

      {rows.length === 0 ? (
        <div className="panel px-5 py-12 text-center text-muted">Nothing in this list.</div>
      ) : (
        <div className="grid gap-5">
          {rows.map((user) => {
            const status = user.specialistReviewStatus ?? "none";
            return (
              <article key={user.id} className="panel overflow-hidden">
                <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-5 py-4">
                  <div>
                    <h2 className="text-lg font-semibold text-ink">{user.displayName}</h2>
                    <p className="text-sm text-muted">
                      {user.profession?.nameEn ?? "Specialist"} · {user.email}
                      {user.phone ? ` · ${user.phone}` : ""}
                      {user.district?.nameBn ? ` · ${user.district.nameBn}` : ""}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${
                      status === "approved"
                        ? "bg-leaf/25 text-forest"
                        : status === "rejected"
                          ? "bg-danger/10 text-danger"
                          : "bg-harvest/15 text-harvest"
                    }`}
                  >
                    {STATUS_LABEL[status]}
                  </span>
                </div>
                <div className="grid gap-4 p-5 md:grid-cols-2">
                  <DocumentFrame label="Certificate" url={user.specialistCertificateUrl} />
                  <DocumentFrame label="National ID" url={user.specialistNidUrl} />
                </div>
                {user.specialistReviewNote ? (
                  <p className="mx-5 mb-4 rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger">
                    {user.specialistReviewNote}
                  </p>
                ) : null}
                <div className="flex flex-col gap-3 border-t border-border px-5 py-4 sm:flex-row sm:items-end">
                  <label className="min-w-0 flex-1 text-sm">
                    <span className="mb-1.5 block font-semibold text-muted">Reason if rejecting</span>
                    <input
                      className="field"
                      value={notes[user.id] ?? ""}
                      onChange={(e) => setNotes((prev) => ({ ...prev, [user.id]: e.target.value }))}
                      placeholder="Photo is unclear, name does not match…"
                    />
                  </label>
                  <button
                    type="button"
                    className="btn btn-primary !min-h-11"
                    disabled={busyId === user.id || status === "approved"}
                    onClick={() => void decide(user, "approve")}
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost !min-h-11"
                    disabled={busyId === user.id}
                    onClick={() => void decide(user, "reject")}
                  >
                    Reject
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}

function DocumentFrame({ label, url }: { label: string; url?: string | null }) {
  return (
    <figure className="overflow-hidden rounded-2xl border border-border bg-panel">
      <figcaption className="border-b border-border px-3 py-2 text-xs font-semibold tracking-wide text-muted uppercase">
        {label}
      </figcaption>
      {url ? (
        <a href={url} target="_blank" rel="noreferrer">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={label} className="h-64 w-full object-contain bg-[var(--white)]" />
        </a>
      ) : (
        <p className="px-3 py-16 text-center text-sm text-muted">No photo</p>
      )}
    </figure>
  );
}

"use client";

import { useEffect, useState } from "react";
import { ApiError, listReports, resolveReport, type SellerReportRow } from "@/lib/api";

function when(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("bn-BD", { dateStyle: "medium", timeStyle: "short" });
}

export default function AdminReportsPage() {
  const [rows, setRows] = useState<SellerReportRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void listReports()
      .then(setRows)
      .catch((e) => setError(e instanceof ApiError ? e.message : "রিপোর্ট আনা যায়নি।"));
  }, []);

  async function act(id: string, action: "dismiss" | "block_seller" | "hide_shop") {
    setBusy(id);
    setError(null);
    try {
      const next = await resolveReport(id, action);
      setRows((list) => list.map((row) => (row.id === id ? { ...row, status: next.status, action } : row)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "কাজটি করা যায়নি।");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-forest md:text-4xl">বিক্রেতা রিপোর্ট</h1>
        <p className="mt-2 max-w-2xl text-muted">
          অ্যাপ থেকে ক্রেতারা দোকান রিপোর্ট করে। এখান থেকে বাতিল করতে, দোকান লুকাতে, বা বিক্রেতার অ্যাকাউন্ট বন্ধ করতে পারবেন।
        </p>
      </div>
      {error ? <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
      {rows.length === 0 ? <p className="text-muted">কোনো রিপোর্ট নেই।</p> : null}
      {rows.map((row) => (
        <article key={row.id} className="panel space-y-3 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink">{row.shop?.name ?? "দোকান"}</h2>
              <p className="text-sm text-muted">
                রিপোর্ট: {row.reporter?.displayName ?? "অজানা"} · বিক্রেতা: {row.seller?.displayName ?? "অজানা"}
              </p>
            </div>
            <p className="text-xs text-muted">{when(row.createdAt)}</p>
          </div>
          <p className="font-semibold text-forest">{row.reason}</p>
          {row.details ? <p className="text-sm leading-relaxed text-ink">{row.details}</p> : null}
          <p className="text-xs font-semibold text-muted">
            {row.status === "open" ? "খোলা" : row.status === "dismissed" ? "বাতিল" : "ব্যবস্থা নেওয়া হয়েছে"}
            {row.seller && !row.seller.isActive ? " · বিক্রেতা বন্ধ" : ""}
            {row.shop && !row.shop.isActive ? " · দোকান লুকানো" : ""}
          </p>
          {row.status === "open" ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-ghost !min-h-10 text-sm" disabled={busy === row.id} onClick={() => void act(row.id, "dismiss")}>
                বাতিল
              </button>
              <button type="button" className="btn btn-soft !min-h-10 text-sm" disabled={busy === row.id} onClick={() => void act(row.id, "hide_shop")}>
                দোকান লুকান
              </button>
              <button type="button" className="btn btn-primary !min-h-10 text-sm" disabled={busy === row.id} onClick={() => void act(row.id, "block_seller")}>
                বিক্রেতা বন্ধ করুন
              </button>
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}

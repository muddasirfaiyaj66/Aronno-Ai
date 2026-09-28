"use client";

import { useEffect, useState } from "react";
import { ApiError, listReports, resolveReport, type SellerReportRow } from "@/lib/api";

function when(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("en-GB", { dateStyle: "medium", timeStyle: "short" });
}

export default function AdminReportsPage() {
  const [rows, setRows] = useState<SellerReportRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void listReports()
      .then(setRows)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load reports."));
  }, []);

  async function act(id: string, action: "dismiss" | "block_seller" | "hide_shop") {
    setBusy(id);
    setError(null);
    try {
      const next = await resolveReport(id, action);
      setRows((list) => list.map((row) => (row.id === id ? { ...row, status: next.status, action } : row)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not update the report.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-semibold text-ink">Seller reports</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Buyers report a shop from the app. Dismiss the report, hide the shop, or block the seller.
        </p>
      </div>
      {error ? <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
      {rows.length === 0 ? <p className="text-muted">No reports.</p> : null}
      {rows.map((row) => (
        <article key={row.id} className="panel space-y-3 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-ink">{row.shop?.name ?? "Shop"}</h2>
              <p className="text-sm text-muted">
                Reporter: {row.reporter?.displayName ?? "Unknown"} · Seller: {row.seller?.displayName ?? "Unknown"}
              </p>
            </div>
            <p className="text-xs text-muted">{when(row.createdAt)}</p>
          </div>
          <p className="font-semibold text-forest">{row.reason}</p>
          {row.details ? <p className="text-sm leading-relaxed text-ink">{row.details}</p> : null}
          <p className="text-xs font-semibold text-muted">
            {row.status === "open" ? "Open" : row.status === "dismissed" ? "Dismissed" : "Actioned"}
            {row.seller && !row.seller.isActive ? " · seller blocked" : ""}
            {row.shop && !row.shop.isActive ? " · shop hidden" : ""}
          </p>
          {row.status === "open" ? (
            <div className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-ghost !min-h-10 text-sm" disabled={busy === row.id} onClick={() => void act(row.id, "dismiss")}>
                Dismiss
              </button>
              <button type="button" className="btn btn-soft !min-h-10 text-sm" disabled={busy === row.id} onClick={() => void act(row.id, "hide_shop")}>
                Hide shop
              </button>
              <button type="button" className="btn btn-primary !min-h-10 text-sm" disabled={busy === row.id} onClick={() => void act(row.id, "block_seller")}>
                Block seller
              </button>
            </div>
          ) : null}
        </article>
      ))}
    </div>
  );
}

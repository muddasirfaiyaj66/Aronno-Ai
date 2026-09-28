"use client";

import { useEffect, useState } from "react";
import { ApiError, listPayouts, resolvePayout, type AdminPayout } from "@/lib/api";

function money(n: number) {
  return `৳${n.toLocaleString("en-BD")}`;
}

const CHANNEL: Record<string, string> = {
  bank: "Bank",
  bkash: "bKash",
  nagad: "Nagad",
};

export default function PayoutsPage() {
  const [rows, setRows] = useState<AdminPayout[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void listPayouts()
      .then(setRows)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load payouts."));
  }, []);

  async function act(id: string, action: "paid" | "rejected") {
    setBusy(id);
    setError(null);
    try {
      const next = await resolvePayout(id, action);
      setRows((list) => list.map((row) => (row.id === id ? { ...row, status: next.status } : row)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not update the payout.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-[0.16em] text-forest uppercase">Treasury</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Seller payouts</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Shop owners request a transfer of their product income. The amount is checked on the server against earnings
          minus earlier payouts. Mark a row paid only after the bank, bKash, or Nagad transfer is sent.
        </p>
      </div>
      {error ? <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
      <section className="panel overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="border-b border-border text-xs tracking-wide text-muted uppercase">
            <tr>
              <th className="px-4 py-3 font-semibold">Seller</th>
              <th className="px-4 py-3 font-semibold">Amount</th>
              <th className="px-4 py-3 font-semibold">Destination</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.id} className="border-b border-border/70">
                <td className="px-4 py-3">
                  <p className="font-semibold text-ink">{row.seller?.displayName ?? "Seller"}</p>
                  <p className="text-xs text-muted">{row.shop?.name ?? row.seller?.email}</p>
                </td>
                <td className="px-4 py-3 font-semibold">{money(row.amountBdt)}</td>
                <td className="px-4 py-3">
                  <p>{CHANNEL[row.channel] ?? row.channel}</p>
                  <p className="text-xs text-muted">
                    {row.accountName} · {row.accountNumber}
                    {row.bankName ? ` · ${row.bankName}` : ""}
                  </p>
                </td>
                <td className="px-4 py-3">
                  {row.status === "pending" ? (
                    <div className="flex gap-2">
                      <button type="button" className="btn btn-primary !min-h-9 text-xs" disabled={busy === row.id} onClick={() => void act(row.id, "paid")}>
                        Mark paid
                      </button>
                      <button type="button" className="btn btn-ghost !min-h-9 text-xs" disabled={busy === row.id} onClick={() => void act(row.id, "rejected")}>
                        Reject
                      </button>
                    </div>
                  ) : (
                    <span className="text-xs font-semibold tracking-wide uppercase">{row.status}</span>
                  )}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-muted">No payout requests yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </div>
  );
}

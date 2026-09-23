"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { RoleDonut, StatusBars } from "@/components/admin/Charts";
import { ApiError, listLoans, patchLoanStatus } from "@/lib/api";
import {
  LOAN_STATUS_BN,
  type AdminLoan,
  type LoanStatus,
} from "@/lib/types";

const STATUS_OPTIONS: LoanStatus[] = [
  "pending",
  "approved",
  "repaying",
  "rejected",
];

const PERIOD_BN: Record<AdminLoan["repaymentPeriod"], string> = {
  THREE_MONTHS: "৩ মাস",
  SIX_MONTHS: "৬ মাস",
  TWELVE_MONTHS: "১২ মাস",
};

export default function AdminLoansPage() {
  const [loans, setLoans] = useState<AdminLoan[]>([]);
  const [filter, setFilter] = useState<"all" | LoanStatus>("all");
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    const rows = await listLoans();
    setLoans(rows);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await reload();
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "ঋণ তালিকা আনা যায়নি।");
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
    if (filter === "all") return loans;
    return loans.filter((l) => l.status === filter);
  }, [loans, filter]);

  const charts = useMemo(() => {
    const byStatus = STATUS_OPTIONS.map((s) => ({
      name: LOAN_STATUS_BN[s],
      value: loans.filter((l) => l.status === s).length,
    }));
    const totalAmount = loans.reduce((sum, l) => sum + l.amountBdt, 0);
    const pendingAmount = loans
      .filter((l) => l.status === "pending")
      .reduce((sum, l) => sum + l.amountBdt, 0);
    return { byStatus, totalAmount, pendingAmount, count: loans.length };
  }, [loans]);

  async function changeStatus(loan: AdminLoan, status: LoanStatus) {
    if (status === loan.status) return;
    setBusyId(loan.id);
    setError(null);
    try {
      const next = await patchLoanStatus(loan.id, status);
      setLoans((prev) => prev.map((row) => (row.id === loan.id ? next : row)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "স্ট্যাটাস আপডেট ব্যর্থ।");
    } finally {
      setBusyId(null);
    }
  }

  if (loading) {
    return <p className="text-muted">ঋণ আবেদন লোড হচ্ছে…</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-3xl text-forest md:text-4xl">
          ঋণ আবেদন
        </h1>
        <p className="mt-1 text-muted">
          কৃষি ঋণ আবেদন পর্যালোচনা ও স্ট্যাটাস আপডেট করুন।
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="kpi-tile">
          <p className="text-sm font-semibold text-muted">মোট আবেদন</p>
          <p className="mt-2 font-display text-4xl text-forest">{charts.count}</p>
        </div>
        <div className="kpi-tile">
          <p className="text-sm font-semibold text-muted">মোট অনুরোধকৃত</p>
          <p className="mt-2 font-display text-3xl text-forest">
            ৳ {charts.totalAmount.toLocaleString("bn-BD")}
          </p>
        </div>
        <div className="kpi-tile">
          <p className="text-sm font-semibold text-muted">অপেক্ষমাণ পরিমাণ</p>
          <p className="mt-2 font-display text-3xl text-harvest">
            ৳ {charts.pendingAmount.toLocaleString("bn-BD")}
          </p>
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="panel p-5">
          <h2 className="text-base font-semibold">স্ট্যাটাস বিতরণ</h2>
          <RoleDonut data={charts.byStatus} />
        </section>
        <section className="panel p-5">
          <h2 className="text-base font-semibold">স্ট্যাটাস তুলনা</h2>
          <StatusBars data={charts.byStatus} />
        </section>
      </div>

      <div className="panel flex flex-wrap gap-2 p-4">
        {(
          [
            ["all", "সব"],
            ...STATUS_OPTIONS.map((s) => [s, LOAN_STATUS_BN[s]] as const),
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`rounded-xl px-3.5 py-2 text-sm font-semibold ${
              filter === id
                ? "bg-forest text-white"
                : "border border-border bg-white text-muted"
            }`}
          >
            {label}
          </button>
        ))}
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
              <th className="px-4 py-3 font-semibold">আবেদনকারী</th>
              <th className="px-4 py-3 font-semibold">উদ্দেশ্য</th>
              <th className="px-4 py-3 font-semibold">পরিমাণ</th>
              <th className="px-4 py-3 font-semibold">মেয়াদ</th>
              <th className="px-4 py-3 font-semibold">স্ট্যাটাস</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((loan) => (
              <tr
                key={loan.id}
                className="border-b border-border last:border-0 hover:bg-panel/60"
              >
                <td className="px-4 py-3">
                  <p className="font-semibold text-ink">{loan.user.displayName}</p>
                  <p className="text-muted">{loan.user.email}</p>
                </td>
                <td className="px-4 py-3 text-ink">{loan.purpose.nameBn}</td>
                <td className="px-4 py-3 font-semibold text-forest">
                  ৳ {loan.amountBdt.toLocaleString("bn-BD")}
                </td>
                <td className="px-4 py-3 text-muted">
                  {PERIOD_BN[loan.repaymentPeriod]}
                </td>
                <td className="px-4 py-3">
                  <select
                    className="field !min-h-9 !py-1"
                    value={loan.status}
                    disabled={busyId === loan.id}
                    onChange={(e) =>
                      void changeStatus(loan, e.target.value as LoanStatus)
                    }
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s} value={s}>
                        {LOAN_STATUS_BN[s]}
                      </option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted">
                  কোনো ঋণ আবেদন নেই।
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}

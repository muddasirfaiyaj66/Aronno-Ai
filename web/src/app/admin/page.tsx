"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  DistrictBars,
  RoleDonut,
  SignupArea,
  StatusBars,
} from "@/components/admin/Charts";
import { buildDashboardStats } from "@/lib/analytics";
import { listUsers } from "@/lib/api";
import type { AuthUser } from "@/lib/types";

export default function AdminOverviewPage() {
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const rows = await listUsers();
        if (!cancelled) setUsers(rows);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "ডেটা আনা যায়নি।");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const stats = useMemo(() => buildDashboardStats(users), [users]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="h-8 w-48 animate-pulse rounded-lg bg-border/60" />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 animate-pulse rounded-2xl bg-white/70" />
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="panel p-6">
        <p className="font-semibold text-danger">{error}</p>
        <p className="mt-2 text-sm text-muted">
          API চালু আছে কি এবং আপনি লগইন করেছেন কি নিশ্চিত করুন।
        </p>
      </div>
    );
  }

  const kpis = [
    { label: "মোট ব্যবহারকারী", value: stats.total, hint: "সব রোল" },
    { label: "কৃষক", value: stats.farmers, hint: "USER রোল" },
    { label: "সক্রিয়", value: stats.active, hint: `${stats.inactive} বন্ধ` },
    {
      label: "ইমেইল যাচাই",
      value: stats.verified,
      hint: `${stats.unverified} অযাচাই`,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-forest md:text-4xl">সারাংশ</h1>
          <p className="mt-1 text-muted">
            অ্যাকাউন্ট বিতরণ, জেলা ও সাপ্তাহিক বৃদ্ধি — এক নজরে।
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/users" className="btn btn-primary !min-h-10 text-sm">
            ব্যবহারকারী
          </Link>
          <Link href="/admin/create" className="btn btn-soft !min-h-10 text-sm">
            নতুন অ্যাডমিন
          </Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((c) => (
          <div key={c.label} className="kpi-tile">
            <p className="text-sm font-semibold text-muted">{c.label}</p>
            <p className="mt-2 font-display text-4xl text-forest">{c.value}</p>
            <p className="mt-1 text-xs text-muted">{c.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="panel p-5">
          <h2 className="text-base font-semibold text-ink">ভূমিকা বিতরণ</h2>
          <p className="text-sm text-muted">কৃষক বনাম অ্যাডমিন অনুপাত</p>
          <div className="mt-2">
            <RoleDonut data={stats.roleBreakdown} />
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="text-base font-semibold text-ink">অ্যাকাউন্ট অবস্থা</h2>
          <p className="text-sm text-muted">সক্রিয় ও বন্ধ অ্যাকাউন্ট</p>
          <div className="mt-2">
            <StatusBars data={stats.statusBreakdown} />
          </div>
        </section>

        <section className="panel p-5 lg:col-span-2">
          <h2 className="text-base font-semibold text-ink">সাপ্তাহিক নতুন অ্যাকাউন্ট</h2>
          <p className="text-sm text-muted">গত ৮ সপ্তাহের নিবন্ধন ধারা</p>
          <div className="mt-2">
            <SignupArea data={stats.weeklySignups} />
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="text-base font-semibold text-ink">জেলা অনুযায়ী</h2>
          <p className="text-sm text-muted">শীর্ষ জেলায় ব্যবহারকারী</p>
          <div className="mt-2">
            <DistrictBars data={stats.topDistricts} />
          </div>
        </section>

        <section className="panel p-5">
          <h2 className="text-base font-semibold text-ink">ইমেইল যাচাই</h2>
          <p className="text-sm text-muted">যাচাইকৃত বনাম অযাচাই</p>
          <div className="mt-2">
            <StatusBars data={stats.verifyBreakdown} />
          </div>
        </section>
      </div>

      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">সাম্প্রতিক অ্যাকাউন্ট</h2>
            <p className="text-sm text-muted">সর্বশেষ নিবন্ধিত ব্যবহারকারী</p>
          </div>
          <Link
            href="/admin/users"
            className="text-sm font-semibold text-forest hover:underline"
          >
            সব দেখুন
          </Link>
        </div>
        <ul className="divide-y divide-border">
          {users.slice(0, 8).map((u) => (
            <li
              key={u.id}
              className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5"
            >
              <div className="min-w-0">
                <p className="truncate font-semibold text-ink">{u.displayName}</p>
                <p className="truncate text-sm text-muted">{u.email}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {u.district?.nameBn ? (
                  <span className="rounded-lg bg-panel px-2.5 py-1 text-xs text-muted">
                    {u.district.nameBn}
                  </span>
                ) : null}
                <span className="rounded-lg bg-leaf/15 px-2.5 py-1 text-xs font-semibold text-forest">
                  {u.role.nameBn}
                </span>
                <span
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold ${
                    u.isActive
                      ? "bg-leaf/20 text-forest"
                      : "bg-danger/10 text-danger"
                  }`}
                >
                  {u.isActive ? "সক্রিয়" : "বন্ধ"}
                </span>
              </div>
            </li>
          ))}
          {users.length === 0 ? (
            <li className="px-5 py-10 text-center text-muted">
              এখনো কোনো ব্যবহারকারী নেই।
            </li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}

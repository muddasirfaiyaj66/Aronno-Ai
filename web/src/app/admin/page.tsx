"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
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

  const stats = useMemo(() => {
    const total = users.length;
    const admins = users.filter(
      (u) => u.role.slug === "ADMIN" || u.role.slug === "SUPERADMIN",
    ).length;
    const farmers = users.filter((u) => u.role.slug === "USER").length;
    const active = users.filter((u) => u.isActive).length;
    const verified = users.filter((u) => !!u.emailVerifiedAt).length;
    return { total, admins, farmers, active, verified };
  }, [users]);

  if (loading) {
    return <p className="text-muted">সারাংশ লোড হচ্ছে…</p>;
  }

  if (error) {
    return <p className="text-danger">{error}</p>;
  }

  const cards = [
    { label: "মোট ব্যবহারকারী", value: stats.total },
    { label: "কৃষক / ইউজার", value: stats.farmers },
    { label: "অ্যাডমিন", value: stats.admins },
    { label: "সক্রিয়", value: stats.active },
    { label: "ইমেইল যাচাই", value: stats.verified },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-forest">সারাংশ</h1>
        <p className="mt-1 text-muted">এক নজরে অ্যাকাউন্ট ও অ্যাডমিন অবস্থা।</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <div
            key={c.label}
            className="rounded-2xl border border-border bg-white px-4 py-5"
          >
            <p className="text-sm font-semibold text-muted">{c.label}</p>
            <p className="mt-2 font-display text-4xl text-forest">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href="/admin/users" className="btn btn-primary">
          সব ব্যবহারকারী দেখুন
        </Link>
        <Link href="/admin/create" className="btn btn-ghost">
          নতুন অ্যাডমিন
        </Link>
      </div>

      <section className="rounded-2xl border border-border bg-white p-5">
        <h2 className="text-lg font-semibold">সাম্প্রতিক অ্যাকাউন্ট</h2>
        <ul className="mt-4 divide-y divide-border">
          {users.slice(0, 6).map((u) => (
            <li
              key={u.id}
              className="flex flex-wrap items-center justify-between gap-2 py-3"
            >
              <div>
                <p className="font-semibold">{u.displayName}</p>
                <p className="text-sm text-muted">{u.email}</p>
              </div>
              <span className="rounded-full bg-sand px-3 py-1 text-xs font-semibold text-forest">
                {u.role.nameBn}
              </span>
            </li>
          ))}
          {users.length === 0 ? (
            <li className="py-6 text-muted">এখনো কোনো ব্যবহারকারী নেই।</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}

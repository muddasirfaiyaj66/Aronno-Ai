"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  DistrictBars,
  RoleDonut,
  SignupArea,
  StatusBars,
} from "@/components/admin/Charts";
import { ApiError, getOverview, type AdminOverview } from "@/lib/api";

function taka(n: number) {
  return `${n.toLocaleString("bn-BD")} টাকা`;
}

const STATUS_BN: Record<string, string> = {
  pending: "অপেক্ষমাণ",
  confirmed: "নিশ্চিত",
  processing: "প্রস্তুত",
  shipped: "পাঠানো",
  delivered: "ডেলিভারি",
  cancelled: "বাতিল",
};

export default function AdminOverviewPage() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void getOverview()
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : "ডেটা আনা যায়নি।"));
  }, []);

  if (!data && !error) {
    return <div className="h-40 animate-pulse rounded-2xl bg-white/70" />;
  }
  if (error || !data) {
    return (
      <div className="panel p-6">
        <p className="font-semibold text-danger">{error}</p>
      </div>
    );
  }

  const kpis = [
    { label: "ব্যবহারকারী", value: String(data.users.total), hint: `${data.users.farmers} কৃষক` },
    { label: "রোগ স্ক্যান", value: String(data.diagnoses), hint: "মোট নির্ণয়" },
    { label: "বিক্রি", value: taka(data.orders.revenue), hint: `${data.orders.total} অর্ডার` },
    { label: "খোলা রিপোর্ট", value: String(data.reportsOpen), hint: `${data.shops.active} সক্রিয় দোকান` },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl text-forest md:text-4xl">সারাংশ</h1>
          <p className="mt-1 text-muted">অ্যাকাউন্ট, স্ক্যান, বিক্রি, দোকান ও রিপোর্ট — এক নজরে।</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/market" className="btn btn-primary !min-h-10 text-sm">বাজার</Link>
          <Link href="/admin/reports" className="btn btn-soft !min-h-10 text-sm">রিপোর্ট</Link>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((card) => (
          <div key={card.label} className="kpi-tile">
            <p className="text-sm font-semibold text-muted">{card.label}</p>
            <p className="mt-2 font-display text-4xl text-forest">{card.value}</p>
            <p className="mt-1 text-xs text-muted">{card.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="panel p-5">
          <h2 className="text-base font-semibold text-ink">ভূমিকা</h2>
          <RoleDonut data={data.roleBreakdown} />
        </section>
        <section className="panel p-5">
          <h2 className="text-base font-semibold text-ink">অর্ডারের অবস্থা</h2>
          <StatusBars
            data={Object.entries(data.orders.byStatus).map(([name, value]) => ({
              name: STATUS_BN[name] ?? name,
              value,
            }))}
          />
        </section>
        <section className="panel p-5 lg:col-span-2">
          <h2 className="text-base font-semibold text-ink">সাপ্তাহিক বিক্রি</h2>
          <p className="text-sm text-muted">বাতিল বাদে, টাকায়</p>
          <SignupArea
            name="বিক্রি (টাকা)"
            data={data.weeklySales.map((row) => ({ label: row.label, count: row.revenue }))}
          />
        </section>
        <section className="panel p-5">
          <h2 className="text-base font-semibold text-ink">যে দোকান বেশি আয় করে</h2>
          <DistrictBars data={data.topShops.map((shop) => ({ name: shop.name, value: shop.revenue }))} />
        </section>
        <section className="panel p-5">
          <h2 className="text-base font-semibold text-ink">জেলা অনুযায়ী ব্যবহারকারী</h2>
          <DistrictBars data={data.topDistricts} />
        </section>
        <section className="panel p-5 lg:col-span-2">
          <h2 className="text-base font-semibold text-ink">নতুন অ্যাকাউন্ট</h2>
          <SignupArea data={data.weeklySignups.map((row) => ({ label: row.label, count: row.count }))} />
        </section>
      </div>

      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-base font-semibold">সাম্প্রতিক বিক্রি</h2>
          <Link href="/admin/market" className="text-sm font-semibold text-forest hover:underline">সব দোকান</Link>
        </div>
        <ul className="divide-y divide-border">
          {data.recentOrders.map((order) => (
            <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
              <div>
                <p className="font-semibold text-ink">{order.shopName}</p>
                <p className="text-sm text-muted">{order.orderNumber}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-forest">{taka(order.totalBdt)}</p>
                <p className="text-xs text-muted">{STATUS_BN[order.status] ?? order.status}</p>
              </div>
            </li>
          ))}
          {data.recentOrders.length === 0 ? (
            <li className="px-5 py-8 text-center text-muted">এখনো কোনো বিক্রি নেই।</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}

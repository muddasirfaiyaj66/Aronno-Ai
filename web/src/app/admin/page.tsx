"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { DistrictBars, RoleDonut, SignupArea, StatusBars } from "@/components/admin/Charts";
import { ApiError, getOverview, type AdminOverview } from "@/lib/api";

function money(n: number) {
  return `৳${n.toLocaleString("en-BD")}`;
}

const STATUS: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const ROLE: Record<string, string> = {
  USER: "Farmers",
  ADMIN: "Admins",
  SUPERADMIN: "Super admins",
};

export default function AdminOverviewPage() {
  const [data, setData] = useState<AdminOverview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [updated, setUpdated] = useState<string>("");

  function load() {
    return getOverview()
      .then((next) => {
        setData(next);
        setError(null);
        setUpdated(new Date().toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" }));
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load the monitor."));
  }

  useEffect(() => {
    void load();
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
    { label: "Accounts", value: String(data.users.total), hint: `${data.users.farmers} farmers · ${data.users.active} active` },
    { label: "Crop scans", value: String(data.diagnoses), hint: "Diagnoses on record" },
    { label: "Settled sales", value: money(data.orders.revenue), hint: `${data.orders.total} orders in view` },
    { label: "Open reports", value: String(data.reportsOpen), hint: `${data.shops.active} shops live` },
  ];

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-forest uppercase">
            <span className="live-dot" /> Operations
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-ink md:text-4xl">Monitor</h1>
          <p className="mt-1 max-w-xl text-muted">
            Accounts, scans, sales, and seller reports. Unpaid online orders are kept out of revenue.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs text-muted">{updated ? `Updated ${updated}` : "Loading"}</p>
          <button type="button" className="btn btn-ghost !min-h-10 text-sm" onClick={() => void load()}>
            Refresh
          </button>
          <Link href="/admin/market" className="btn btn-primary !min-h-10 text-sm">Market</Link>
          <Link href="/admin/delivery" className="btn btn-soft !min-h-10 text-sm">Delivery fees</Link>
        </div>
      </div>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { href: "/admin/users", label: "Blocked accounts", value: data.users.inactive },
          { href: "/admin/users", label: "Unverified email", value: data.users.unverified },
          { href: "/admin/market", label: "Hidden shops", value: data.shops.total - data.shops.active },
          { href: "/admin/reports", label: "Open reports", value: data.reportsOpen },
        ].map((item) => (
          <Link key={item.label} href={item.href} className="panel flex items-center justify-between px-4 py-3">
            <span className="text-sm text-muted">{item.label}</span>
            <span className="text-xl font-semibold text-ink">{item.value}</span>
          </Link>
        ))}
      </section>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map((card) => (
          <div key={card.label} className="kpi-tile">
            <p className="text-xs font-semibold tracking-wide text-muted uppercase">{card.label}</p>
            <p className="mt-2 text-3xl font-semibold tracking-tight text-ink">{card.value}</p>
            <p className="mt-1 text-xs text-muted">{card.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <section className="panel p-5">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Roles</h2>
          <RoleDonut
            data={data.roleBreakdown.map((row) => ({
              name: ROLE[row.name] ?? row.name,
              value: row.value,
            }))}
          />
        </section>
        <section className="panel p-5">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Order status</h2>
          <StatusBars
            data={Object.entries(data.orders.byStatus).map(([name, value]) => ({
              name: STATUS[name] ?? name,
              value,
            }))}
          />
        </section>
        <section className="panel p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Weekly settled sales</h2>
          <p className="mb-2 text-sm text-muted">Taka collected on cash orders and verified online payments.</p>
          <SignupArea
            name="Sales (BDT)"
            data={data.weeklySales.map((row) => ({ label: row.label, count: row.revenue }))}
          />
        </section>
        <section className="panel p-5">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Top shops</h2>
          <DistrictBars data={data.topShops.map((shop) => ({ name: shop.name, value: shop.revenue }))} />
        </section>
        <section className="panel p-5">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Users by district</h2>
          <DistrictBars data={data.topDistricts} />
        </section>
        <section className="panel p-5 lg:col-span-2">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">New accounts</h2>
          <SignupArea
            name="New accounts"
            data={data.weeklySignups.map((row) => ({ label: row.label, count: row.count }))}
          />
        </section>
      </div>

      <section className="panel overflow-hidden">
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="text-sm font-semibold tracking-wide text-muted uppercase">Recent sales</h2>
          <Link href="/admin/market" className="text-sm font-semibold text-forest hover:underline">All shops</Link>
        </div>
        <ul className="divide-y divide-border">
          {data.recentOrders.map((order) => (
            <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3.5">
              <div>
                <p className="font-semibold text-ink">{order.shopName}</p>
                <p className="text-sm text-muted">{order.orderNumber}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold text-forest">{money(order.totalBdt)}</p>
                <p className="text-xs text-muted">{STATUS[order.status] ?? order.status}</p>
              </div>
            </li>
          ))}
          {data.recentOrders.length === 0 ? (
            <li className="px-5 py-8 text-center text-muted">No sales yet.</li>
          ) : null}
        </ul>
      </section>
    </div>
  );
}

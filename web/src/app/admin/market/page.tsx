"use client";

import { useEffect, useState } from "react";
import { ApiError, getCommerce, setShopActive, type AdminOrderRow, type AdminShopRow } from "@/lib/api";

function taka(n: number) {
  return `৳${n.toLocaleString("en-BD")}`;
}

const STATUS_EN: Record<string, string> = {
  pending: "Pending",
  confirmed: "Confirmed",
  processing: "Processing",
  shipped: "Shipped",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

export default function AdminMarketPage() {
  const [shops, setShops] = useState<AdminShopRow[]>([]);
  const [orders, setOrders] = useState<AdminOrderRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    void getCommerce()
      .then((data) => {
        setShops([...data.shops].sort((a, b) => b.revenue - a.revenue));
        setOrders(data.orders);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load the market."));
  }, []);

  async function toggleShop(shop: AdminShopRow) {
    setBusy(shop.id);
    setError(null);
    try {
      const next = await setShopActive(shop.id, !shop.isActive);
      setShops((rows) => rows.map((row) => (row.id === shop.id ? { ...row, isActive: next.isActive } : row)));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not update the shop.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-semibold text-ink">Market</h1>
        <p className="mt-2 text-muted">Shop earnings, recent sales, and whether a shop is visible.</p>
      </div>
      {error ? <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}

      <section className="panel overflow-x-auto">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="border-b border-border text-muted">
            <tr>
              <th className="px-4 py-3 font-semibold">Shop</th>
              <th className="px-4 py-3 font-semibold">Owner</th>
              <th className="px-4 py-3 font-semibold">Orders</th>
              <th className="px-4 py-3 font-semibold">Revenue</th>
              <th className="px-4 py-3 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {shops.map((shop) => (
              <tr key={shop.id} className="border-b border-border/70">
                <td className="px-4 py-3">
                  <p className="font-semibold text-ink">{shop.name}</p>
                  <p className="text-xs text-muted">{shop.district} · {shop.products} products</p>
                </td>
                <td className="px-4 py-3">
                  <p>{shop.ownerName}</p>
                  <p className="text-xs text-muted">{shop.ownerActive ? "Account active" : "Account blocked"}</p>
                </td>
                <td className="px-4 py-3">{shop.orders}</td>
                <td className="px-4 py-3 font-semibold text-forest">{taka(shop.revenue)}</td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    className="btn btn-ghost !min-h-9 text-xs"
                    disabled={busy === shop.id}
                    onClick={() => void toggleShop(shop)}
                  >
                    {shop.isActive ? "Hide" : "Reopen"}
                  </button>
                </td>
              </tr>
            ))}
            {shops.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-muted">No shops yet.</td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>

      <section className="panel overflow-hidden">
        <h2 className="border-b border-border px-5 py-4 text-sm font-semibold tracking-wide text-muted uppercase">Recent sales</h2>
        <ul className="divide-y divide-border">
          {orders.map((order) => (
            <li key={order.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
              <div>
                <p className="font-semibold text-ink">{order.shopName}</p>
                <p className="text-sm text-muted">{order.buyerName} · {order.orderNumber}</p>
              </div>
              <div className="text-right">
                <p className="font-semibold">{taka(order.totalBdt)}</p>
                <p className="text-xs text-muted">{STATUS_EN[order.status] ?? order.status}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

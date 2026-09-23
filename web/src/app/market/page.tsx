"use client";

import { useCallback, useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { PublicShell } from "@/components/marketing/PublicChrome";
import {
  fetchMarketPrices,
  fetchPublicProducts,
  fetchPublicShops,
  formatTaka,
  type MarketPriceRow,
  type PublicProduct,
  type PublicShop,
} from "@/lib/publicApi";

const CROP_BN: Record<string, string> = {
  rice: "ধান",
  potato: "আলু",
  tomato: "টমেটো",
  vegetable: "সবজি",
  onion: "পেঁয়াজ",
  corn: "ভুট্টা",
  lentil: "ডাল",
};

const CATEGORY_BN: Record<string, string> = {
  crops: "শস্য",
  vegetables: "সবজি",
  fruits: "ফল",
  seeds: "বীজ",
  fertilizers: "সার",
  pesticides: "কীটনাশক",
  tools: "যন্ত্রপাতি",
  fish: "মাছ",
  dairy: "দুগ্ধ",
  eggs: "ডিম",
  other: "অন্যান্য",
};

export default function MarketPage() {
  const [prices, setPrices] = useState<MarketPriceRow[]>([]);
  const [products, setProducts] = useState<PublicProduct[]>([]);
  const [shops, setShops] = useState<PublicShop[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"prices" | "products" | "shops">("products");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [priceRes, productRes, shopRes] = await Promise.all([
        fetchMarketPrices().catch(() => ({ markets: [] as MarketPriceRow[] })),
        fetchPublicProducts(24).catch(() => ({
          items: [] as PublicProduct[],
          total: 0,
          page: 1,
          totalPages: 0,
        })),
        fetchPublicShops(12).catch(() => [] as PublicShop[]),
      ]);
      setPrices(priceRes.markets ?? []);
      setProducts(productRes.items ?? []);
      setShops(shopRes);
    } catch (e) {
      setError(e instanceof Error ? e.message : "বাজার ডেটা আনা যায়নি।");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <PublicShell
      title="কৃষি বাজার"
      subtitle="স্থানীয় দাম, বিক্রির পণ্য ও দোকান — সবাই দেখতে পারেন। কেনাবেচা অ্যাপে।"
    >
      <div className="mb-8 flex flex-wrap gap-2">
        {(
          [
            ["products", "পণ্য"],
            ["prices", "বাজার দাম"],
            ["shops", "দোকান"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`rounded-xl px-4 py-2 text-sm font-semibold ${
              tab === id
                ? "bg-forest text-white"
                : "border border-border bg-white text-muted"
            }`}
          >
            {label}
          </button>
        ))}
        <Link href="/heatmap" className="btn btn-ghost !min-h-9 ml-auto text-sm">
          হিট ম্যাপ দেখুন
        </Link>
      </div>

      {error ? (
        <div className="panel mb-6 space-y-3 p-5">
          <p className="font-semibold text-danger">{error}</p>
          <button type="button" className="btn btn-primary" onClick={() => void load()}>
            আবার চেষ্টা
          </button>
        </div>
      ) : null}

      {loading ? (
        <p className="text-muted">লোড হচ্ছে…</p>
      ) : null}

      {!loading && tab === "prices" ? (
        <section>
          <p className="mb-4 text-sm text-muted">
            বাজার অনুযায়ী প্রতি মণের দাম (হালনাগাদ)।
          </p>
          {prices.length === 0 ? (
            <Empty msg="এখনো কোনো বাজার দাম নেই।" />
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border bg-white">
              <table className="min-w-full text-left text-sm">
                <thead className="border-b border-border bg-panel text-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">বাজার</th>
                    <th className="px-4 py-3 font-semibold">ফসল</th>
                    <th className="px-4 py-3 font-semibold">দাম / মণ</th>
                    <th className="px-4 py-3 font-semibold">প্রবণতা</th>
                  </tr>
                </thead>
                <tbody>
                  {prices.map((row) => (
                    <tr key={row.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-semibold text-ink">
                        {row.marketNameBn}
                        {row.bestPrice ? (
                          <span className="ml-2 rounded-md bg-leaf/20 px-1.5 py-0.5 text-xs text-forest">
                            সর্বোচ্চ
                          </span>
                        ) : null}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {CROP_BN[row.cropType] ?? row.cropType}
                      </td>
                      <td className="px-4 py-3 font-semibold text-forest">
                        {formatTaka(row.pricePerMon)}
                      </td>
                      <td className="px-4 py-3 text-muted">
                        {row.trend === "up"
                          ? `↑ ${row.changePercent}%`
                          : row.trend === "down"
                            ? `↓ ${row.changePercent}%`
                            : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      ) : null}

      {!loading && tab === "products" ? (
        <section>
          <p className="mb-4 text-sm text-muted">
            সক্রিয় তালিকাভুক্ত পণ্য — বিস্তারিত ও অর্ডার অ্যাপে।
          </p>
          {products.length === 0 ? (
            <Empty msg="এখনো কোনো পণ্য প্রকাশিত হয়নি।" />
          ) : (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((p) => {
                const img = p.images?.[0]?.url;
                return (
                  <article
                    key={p.id}
                    className="overflow-hidden rounded-2xl border border-border bg-white"
                  >
                    <div className="relative aspect-[4/3] bg-panel">
                      {img ? (
                        <Image
                          src={img}
                          alt=""
                          fill
                          className="object-cover"
                          sizes="(max-width:768px) 100vw, 33vw"
                          unoptimized
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center text-sm text-muted">
                          ছবি নেই
                        </div>
                      )}
                    </div>
                    <div className="space-y-1.5 p-4">
                      <p className="text-xs font-semibold tracking-wide text-muted">
                        {CATEGORY_BN[p.category] ?? p.category}
                      </p>
                      <h2 className="text-lg font-semibold text-ink">{p.name}</h2>
                      <p className="font-display text-xl text-forest">
                        {formatTaka(p.pricePerUnit)}
                        <span className="ml-1 text-sm font-sans font-normal text-muted">
                          / {p.unit}
                        </span>
                      </p>
                      <p className="text-sm text-muted">
                        {p.shop?.name ?? "দোকান"}
                        {p.district?.nameBn ? ` · ${p.district.nameBn}` : ""}
                      </p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      ) : null}

      {!loading && tab === "shops" ? (
        <section>
          <p className="mb-4 text-sm text-muted">নিবন্ধিত কৃষি দোকানসমূহ।</p>
          {shops.length === 0 ? (
            <Empty msg="এখনো কোনো দোকান নেই।" />
          ) : (
            <ul className="grid gap-4 sm:grid-cols-2">
              {shops.map((s) => (
                <li key={s.id} className="panel flex gap-4 p-4">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-panel">
                    {s.logoUrl ? (
                      <Image
                        src={s.logoUrl}
                        alt=""
                        fill
                        className="object-cover"
                        unoptimized
                      />
                    ) : null}
                  </div>
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold text-ink">{s.name}</h2>
                    <p className="mt-1 text-sm text-muted">
                      {s.district?.nameBn ?? "জেলা অজানা"}
                      {s._count?.products != null
                        ? ` · ${s._count.products} পণ্য`
                        : ""}
                    </p>
                    {s.description ? (
                      <p className="mt-2 line-clamp-2 text-sm text-muted">
                        {s.description}
                      </p>
                    ) : null}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      ) : null}
    </PublicShell>
  );
}

function Empty({ msg }: { msg: string }) {
  return (
    <div className="panel px-5 py-12 text-center text-muted">{msg}</div>
  );
}

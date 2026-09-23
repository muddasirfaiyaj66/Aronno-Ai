"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import {
  fetchHeatmap,
  HEAT_COLORS,
  HEAT_LABEL_BN,
  type HeatmapArea,
  type HeatmapResponse,
} from "@/lib/publicApi";
import { PublicShell } from "@/components/marketing/PublicChrome";

const DiseaseHeatMapClient = dynamic(
  () =>
    import("@/components/public/DiseaseHeatMap").then(
      (m) => m.DiseaseHeatMapClient,
    ),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-[min(70vh,560px)] items-center justify-center rounded-2xl border border-border bg-panel text-sm text-muted">
        মানচিত্র লোড হচ্ছে…
      </div>
    ),
  },
);

export default function HeatmapPage() {
  const [data, setData] = useState<HeatmapResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(60);
  const [selectedSlug, setSelectedSlug] = useState<string | null>(null);

  const load = useCallback(async (windowDays: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetchHeatmap(windowDays);
      setData(res);
      setSelectedSlug((prev) => {
        if (prev && res.areas.some((a) => a.location.slug === prev)) return prev;
        return res.areas[0]?.location.slug ?? null;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "হিট ম্যাপ আনা যায়নি।");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(days);
  }, [days, load]);

  const selected: HeatmapArea | null = useMemo(() => {
    if (!data || !selectedSlug) return null;
    return data.areas.find((a) => a.location.slug === selectedSlug) ?? null;
  }, [data, selectedSlug]);

  const totals = useMemo(() => {
    if (!data) return { areas: 0, cases: 0 };
    return {
      areas: data.areas.length,
      cases: data.areas.reduce((s, a) => s + a.caseCount, 0),
    };
  }, [data]);

  return (
    <PublicShell
      title="রোগের হিট ম্যাপ"
      subtitle="কৃষকদের স্ক্যান থেকে জেলাভিত্তিক রোগের প্রাদুর্ভাব — OpenStreetMap‑এ দেখুন।"
    >
      <div className="mb-6 flex flex-wrap items-center gap-2">
        {([30, 60, 90] as const).map((d) => (
          <button
            key={d}
            type="button"
            onClick={() => setDays(d)}
            className={`rounded-xl px-3.5 py-2 text-sm font-semibold ${
              days === d
                ? "bg-forest text-white"
                : "border border-border bg-white text-muted"
            }`}
          >
            গত {d} দিন
          </button>
        ))}
        {!loading && data ? (
          <p className="ml-auto text-sm text-muted">
            {totals.areas} জেলা · {totals.cases}টি রিপোর্ট
          </p>
        ) : null}
      </div>

      {error ? (
        <div className="panel space-y-3 p-6">
          <p className="font-semibold text-danger">{error}</p>
          <p className="text-sm text-muted">
            API চালু আছে কি দেখুন, তারপর আবার চেষ্টা করুন।
          </p>
          <button type="button" className="btn btn-primary" onClick={() => void load(days)}>
            আবার চেষ্টা
          </button>
        </div>
      ) : null}

      {loading && !data ? (
        <div className="flex h-[min(70vh,560px)] items-center justify-center rounded-2xl border border-border bg-panel text-muted">
          ডেটা আনা হচ্ছে…
        </div>
      ) : null}

      {data ? (
        <div className="grid gap-6 lg:grid-cols-[1.4fr_0.9fr]">
          <DiseaseHeatMapClient
            areas={data.areas}
            selectedSlug={selectedSlug}
            onSelect={setSelectedSlug}
          />

          <aside className="space-y-4">
            <div className="flex flex-wrap gap-4">
              {(["low", "medium", "high"] as const).map((level) => (
                <div key={level} className="flex items-center gap-2 text-sm text-muted">
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ background: HEAT_COLORS[level] }}
                  />
                  {HEAT_LABEL_BN[level]}
                </div>
              ))}
            </div>

            {selected ? (
              <div className="panel p-5">
                <p className="text-sm font-semibold text-muted">নির্বাচিত জেলা</p>
                <h2 className="mt-1 font-display text-2xl text-forest">
                  {selected.location.nameBn}
                </h2>
                <p className="mt-2 text-sm text-muted">
                  প্রাদুর্ভাব {HEAT_LABEL_BN[selected.level]} · মোট{" "}
                  {selected.caseCount}টি রিপোর্ট
                </p>
                <ul className="mt-4 divide-y divide-border">
                  {selected.diseases.map((d) => (
                    <li
                      key={d.diseaseType.nameEn}
                      className="flex items-center justify-between gap-3 py-3"
                    >
                      <span className="font-semibold text-ink">
                        {d.diseaseType.nameBn}
                      </span>
                      <span className="text-sm text-muted">{d.caseCount}টি</span>
                    </li>
                  ))}
                  {selected.diseases.length === 0 ? (
                    <li className="py-4 text-sm text-muted">রোগের বিবরণ নেই।</li>
                  ) : null}
                </ul>
              </div>
            ) : (
              <div className="panel p-5 text-sm text-muted">
                মানচিত্রে কোনো জেলায় ক্লিক করুন।
              </div>
            )}

            <div className="panel max-h-72 overflow-y-auto p-2">
              {data.areas
                .slice()
                .sort((a, b) => b.severityScore - a.severityScore)
                .map((a) => (
                  <button
                    key={a.location.slug}
                    type="button"
                    onClick={() => setSelectedSlug(a.location.slug)}
                    className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm transition ${
                      selectedSlug === a.location.slug
                        ? "bg-forest/10 text-forest"
                        : "hover:bg-panel"
                    }`}
                  >
                    <span
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: HEAT_COLORS[a.level] }}
                    />
                    <span className="flex-1 font-semibold">{a.location.nameBn}</span>
                    <span className="text-muted">{a.caseCount}</span>
                  </button>
                ))}
              {data.areas.length === 0 ? (
                <p className="px-3 py-6 text-center text-sm text-muted">
                  এই সময়ে কোনো রোগের রিপোর্ট নেই।
                </p>
              ) : null}
            </div>
          </aside>
        </div>
      ) : null}
    </PublicShell>
  );
}

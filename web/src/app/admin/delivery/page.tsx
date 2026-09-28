"use client";

import { FormEvent, useEffect, useState } from "react";
import { ApiError, getDeliveryRates, setDeliveryRates, type DeliveryRates } from "@/lib/api";

export default function DeliverySettingsPage() {
  const [rates, setRates] = useState<DeliveryRates | null>(null);
  const [sameCity, setSameCity] = useState("60");
  const [otherCity, setOtherCity] = useState("120");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void getDeliveryRates()
      .then((row) => {
        setRates(row);
        setSameCity(String(row.sameCityBdt));
        setOtherCity(String(row.otherCityBdt));
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load delivery fees."));
  }, []);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    setSaved(false);
    try {
      const next = await setDeliveryRates(Number(sameCity), Number(otherCity));
      setRates(next);
      setSaved(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save delivery fees.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-semibold tracking-[0.16em] text-forest uppercase">Commerce</p>
        <h1 className="mt-2 text-3xl font-semibold text-ink">Delivery fees</h1>
        <p className="mt-2 max-w-2xl text-muted">
          The app never chooses the fee. Checkout compares the shop district with the delivery district on the server.
          Same city starts at 60 taka. Another city starts at 120 taka.
        </p>
      </div>
      <form onSubmit={onSubmit} className="panel max-w-xl space-y-4 p-6">
        <label className="block">
          <span className="text-sm font-semibold text-ink">Same city as the shop (BDT)</span>
          <input
            type="number"
            min={0}
            max={5000}
            value={sameCity}
            onChange={(event) => setSameCity(event.target.value)}
            className="field mt-2"
          />
        </label>
        <label className="block">
          <span className="text-sm font-semibold text-ink">Other city (BDT)</span>
          <input
            type="number"
            min={0}
            max={5000}
            value={otherCity}
            onChange={(event) => setOtherCity(event.target.value)}
            className="field mt-2"
          />
        </label>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        {saved ? <p className="text-sm font-semibold text-forest">Saved. New checkouts use these rates.</p> : null}
        <button type="submit" className="btn btn-primary !min-h-11" disabled={busy || !rates}>
          {busy ? "Saving…" : "Save fees"}
        </button>
      </form>
    </div>
  );
}

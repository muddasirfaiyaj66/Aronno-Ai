"use client";

import { FormEvent, useEffect, useState } from "react";
import {
  ApiError,
  listBroadcasts,
  listHeatPlaces,
  listUsers,
  sendBroadcast,
  type AdminBroadcast,
  type BroadcastPriority,
  type HeatPlace,
} from "@/lib/api";
import type { AuthUser } from "@/lib/types";

const PRIORITY: { id: BroadcastPriority; label: string }[] = [
  { id: "normal", label: "সাধারণ" },
  { id: "important", label: "গুরুত্বপূর্ণ" },
  { id: "emergency", label: "জরুরি" },
];

function when(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("bn-BD", { dateStyle: "medium", timeStyle: "short" });
}

export default function AdminNotificationsPage() {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [priority, setPriority] = useState<BroadcastPriority>("normal");
  const [audience, setAudience] = useState<"all" | "user" | "district">("all");
  const [userId, setUserId] = useState("");
  const [districtSlug, setDistrictSlug] = useState("");
  const [places, setPlaces] = useState<HeatPlace[]>([]);
  const [users, setUsers] = useState<AuthUser[]>([]);
  const [history, setHistory] = useState<AdminBroadcast[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void listUsers()
      .then(setUsers)
      .catch(() => setUsers([]));
    void listBroadcasts()
      .then(setHistory)
      .catch(() => setHistory([]));
    void listHeatPlaces()
      .then(setPlaces)
      .catch(() => setPlaces([]));
  }, []);

  function applyPlace(slug: string) {
    const place = places.find((item) => item.slug === slug);
    setDistrictSlug(slug);
    if (!place) return;
    setAudience("district");
    setPriority(place.priority);
    setTitle(place.title);
    setBody(place.body);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    setLoading(true);
    try {
      const sent = await sendBroadcast({
        title: title.trim(),
        body: body.trim(),
        priority,
        audience,
        userId: audience === "user" ? userId : undefined,
        districtSlug: audience === "district" ? districtSlug : undefined,
      });
      setOk(`${sent.recipientCount} জন ব্যবহারকারীর কাছে পাঠানো হয়েছে।`);
      setTitle("");
      setBody("");
      setHistory((prev) => [sent, ...prev]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "বিজ্ঞপ্তি পাঠানো যায়নি।");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="font-display text-3xl text-forest md:text-4xl">বিজ্ঞপ্তি পাঠান</h1>
        <p className="mt-2 max-w-2xl text-muted">
          সবাইকে, একজনকে, অথবা হিট ম্যাপের জেলায়। জেলার বার্তা রোগের হিসাব থেকে সাজানো থাকে — পাঠানোর আগে বদলাতে পারবেন।
        </p>
      </div>

      <form onSubmit={onSubmit} className="panel space-y-4 p-6 sm:p-8">
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-muted">হিট ম্যাপের জেলা</span>
          <select className="field" value={districtSlug} onChange={(e) => applyPlace(e.target.value)}>
            <option value="">জেলা বেছে নিলে বার্তা বসে যাবে</option>
            {places.map((place) => (
              <option key={place.slug} value={place.slug}>
                {place.nameBn} · {place.caseCount} রিপোর্ট · {place.level}
              </option>
            ))}
          </select>
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-muted">শিরোনাম</span>
          <input className="field" required minLength={2} maxLength={120} value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-muted">বার্তা</span>
          <textarea className="field min-h-28" required minLength={2} maxLength={600} value={body} onChange={(e) => setBody(e.target.value)} />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-muted">গুরুত্ব</span>
            <select className="field" value={priority} onChange={(e) => setPriority(e.target.value as BroadcastPriority)}>
              {PRIORITY.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-muted">কাদের কাছে</span>
            <select
              className="field"
              value={audience}
              onChange={(e) => setAudience(e.target.value as "all" | "user" | "district")}
            >
              <option value="all">সব ব্যবহারকারী</option>
              <option value="district">হিট ম্যাপের জেলা</option>
              <option value="user">একজন ব্যবহারকারী</option>
            </select>
          </label>
        </div>
        {audience === "user" ? (
          <label className="block space-y-1.5">
            <span className="text-sm font-semibold text-muted">ব্যবহারকারী</span>
            <select className="field" required value={userId} onChange={(e) => setUserId(e.target.value)}>
              <option value="">বেছে নিন</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.displayName} · {user.email}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        {error ? <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p> : null}
        {ok ? <p className="rounded-xl bg-leaf/15 px-3 py-2 text-sm font-semibold text-forest">{ok}</p> : null}
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? "পাঠানো হচ্ছে…" : "বিজ্ঞপ্তি পাঠান"}
        </button>
      </form>

      <section className="space-y-3">
        <h2 className="font-display text-2xl text-forest">সাম্প্রতিক পাঠানো</h2>
        {history.length === 0 ? (
          <p className="text-muted">এখনও কোনো অ্যাডমিন বিজ্ঞপ্তি নেই।</p>
        ) : (
          history.map((item) => (
            <article key={item.id} className="panel px-5 py-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-ink">{item.title}</h3>
                <p className="text-xs text-muted">{when(item.createdAt)}</p>
              </div>
              <p className="mt-1 text-sm text-muted">{item.body}</p>
              <p className="mt-2 text-xs font-semibold text-forest">
                {item.priority === "emergency" ? "জরুরি" : item.priority === "important" ? "গুরুত্বপূর্ণ" : "সাধারণ"}
                {" · "}
                {item.audience === "user" ? "একজন" : item.audience === "district" ? "জেলা" : "সবাই"}
                {" · "}
                {item.recipientCount} জন
              </p>
            </article>
          ))
        )}
      </section>
    </div>
  );
}

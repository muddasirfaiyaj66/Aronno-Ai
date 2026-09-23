"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { ApiError, createAdmin } from "@/lib/api";

export default function CreateAdminPage() {
  const router = useRouter();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setOk(null);
    setLoading(true);
    try {
      const user = await createAdmin({
        displayName: displayName.trim(),
        email: email.trim().toLowerCase(),
        password,
      });
      setOk(`${user.displayName} অ্যাডমিন হিসেবে তৈরি হয়েছে।`);
      setDisplayName("");
      setEmail("");
      setPassword("");
      setTimeout(() => router.push("/admin/users"), 900);
    } catch (err) {
      setError(
        err instanceof ApiError ? err.message : "অ্যাডমিন তৈরি করা যায়নি।",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <h1 className="font-display text-3xl text-forest md:text-4xl">
          নতুন অ্যাডমিন
        </h1>
        <p className="mt-1 text-muted">
          পাসওয়ার্ডে অন্তত ১০ অক্ষর, বড়/ছোট হাত, সংখ্যা ও বিশেষ চিহ্ন লাগবে।
        </p>
      </div>

      <form onSubmit={onSubmit} className="panel space-y-4 p-6 sm:p-8">
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-muted">নাম</span>
          <input
            className="field"
            required
            minLength={2}
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="যেমন: রহিম অ্যাডমিন"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-muted">ইমেইল</span>
          <input
            className="field"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin2@example.com"
          />
        </label>
        <label className="block space-y-1.5">
          <span className="text-sm font-semibold text-muted">পাসওয়ার্ড</span>
          <input
            className="field"
            type="password"
            required
            minLength={10}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="শক্তিশালী পাসওয়ার্ড"
          />
        </label>

        {error ? (
          <p className="rounded-xl bg-danger/10 px-3 py-2 text-sm text-danger">
            {error}
          </p>
        ) : null}
        {ok ? (
          <p className="rounded-xl bg-leaf/15 px-3 py-2 text-sm font-semibold text-forest">
            {ok}
          </p>
        ) : null}

        <button type="submit" className="btn btn-primary w-full" disabled={loading}>
          {loading ? "তৈরি হচ্ছে…" : "অ্যাডমিন তৈরি করুন"}
        </button>
      </form>
    </div>
  );
}

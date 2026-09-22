"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ApiError, login } from "@/lib/api";
import { isStaff } from "@/lib/types";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const user = await login(email.trim().toLowerCase(), password);
      if (!isStaff(user.role.slug)) {
        setError("শুধু অ্যাডমিন অ্যাকাউন্ট দিয়ে প্রবেশ করা যায়।");
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "লগইন করা যায়নি। ইমেইল ও পাসওয়ার্ড দেখুন।",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="leaf-wash flex min-h-screen flex-col">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-5 py-12">
        <Link href="/" className="mb-8 flex items-center gap-3 self-start">
          <Image src="/icon.png" alt="" width={40} height={40} className="rounded-xl" />
          <span className="font-display text-2xl text-forest">আরণ্য</span>
        </Link>

        <div className="rounded-3xl border border-border bg-white p-6 shadow-[0_24px_60px_-36px_rgba(15,47,38,0.45)] sm:p-8">
          <h1 className="font-display text-3xl text-forest">অ্যাডমিন লগইন</h1>
          <p className="mt-2 text-muted">
            শুধু অনুমোদিত অ্যাডমিন ও সুপারঅ্যাডমিন প্রবেশ করতে পারবেন।
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-4">
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-muted">ইমেইল</span>
              <input
                className="field"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
              />
            </label>
            <label className="block space-y-1.5">
              <span className="text-sm font-semibold text-muted">পাসওয়ার্ড</span>
              <input
                className="field"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••••"
              />
            </label>

            {error ? (
              <p className="text-sm font-medium text-danger" role="alert">
                {error}
              </p>
            ) : null}

            <button type="submit" className="btn btn-primary w-full" disabled={loading}>
              {loading ? "প্রবেশ হচ্ছে…" : "প্রবেশ করুন"}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-muted">
          <Link href="/" className="font-semibold text-forest hover:underline">
            প্রচার পাতায় ফিরে যান
          </Link>
        </p>
      </div>
    </div>
  );
}

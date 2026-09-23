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
    <div className="relative flex min-h-screen">
      <div className="hero-field relative hidden w-[46%] overflow-hidden lg:block">
        <div className="hero-sheen absolute inset-0" />
        <div className="relative flex h-full flex-col justify-end p-12 text-sand">
          <p className="font-display text-6xl leading-none">আরণ্য</p>
          <p className="mt-6 max-w-sm text-lg text-sand/75">
            দলের জন্য নিরাপদ অ্যাডমিন প্যানেল — ব্যবহারকারী, ঋণ ও বিশ্লেষণ।
          </p>
        </div>
      </div>

      <div className="site-canvas flex flex-1 flex-col justify-center px-5 py-12">
        <div className="mx-auto w-full max-w-md">
          <Link href="/" className="mb-8 flex items-center gap-3 lg:hidden">
            <Image
              src="/icon.png"
              alt=""
              width={40}
              height={40}
              className="rounded-xl"
            />
            <span className="font-display text-2xl text-forest">আরণ্য</span>
          </Link>

          <div className="panel p-6 shadow-[0_24px_60px_-40px_rgba(10,40,31,0.45)] sm:p-8">
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
                <p
                  className="rounded-xl bg-danger/10 px-3 py-2 text-sm font-medium text-danger"
                  role="alert"
                >
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                className="btn btn-primary w-full"
                disabled={loading}
              >
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
    </div>
  );
}

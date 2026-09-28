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
        setError("Only an admin account can sign in here.");
        return;
      }
      router.replace("/admin");
      router.refresh();
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : "Could not sign in. Check the email and password.",
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
          <p className="text-6xl leading-none font-semibold">Aronno</p>
          <p className="mt-6 max-w-sm text-lg text-sand/75">
            Operations monitor for accounts, sales, payouts, and delivery fees.
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
            <span className="text-2xl font-semibold text-forest">Aronno</span>
          </Link>

          <div className="panel p-6 shadow-[0_24px_60px_-40px_rgba(10,40,31,0.45)] sm:p-8">
            <h1 className="text-3xl font-semibold text-ink">Admin sign in</h1>
            <p className="mt-2 text-muted">Only an admin or super admin can open the monitor.</p>

            <form onSubmit={onSubmit} className="mt-8 space-y-4">
              <label className="block space-y-1.5">
                <span className="text-sm font-semibold text-muted">Email</span>
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
                <span className="text-sm font-semibold text-muted">Password</span>
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
                {loading ? "Signing in…" : "Sign in"}
              </button>
            </form>
          </div>

          <p className="mt-6 text-center text-sm text-muted">
            <Link href="/" className="font-semibold text-forest hover:underline">
              Back to the site
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

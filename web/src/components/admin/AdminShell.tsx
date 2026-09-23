"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { getMe, logout } from "@/lib/api";
import { isStaff, type AuthUser } from "@/lib/types";

const NAV = [
  { href: "/admin", label: "সারাংশ", icon: "◈" },
  { href: "/admin/users", label: "ব্যবহারকারী", icon: "◎" },
  { href: "/admin/create", label: "অ্যাডমিন তৈরি", icon: "＋" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await getMe();
        if (cancelled) return;
        if (!isStaff(user.role.slug)) {
          router.replace("/admin/login");
          return;
        }
        setMe(user);
      } catch {
        if (!cancelled) router.replace("/admin/login");
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [router]);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  async function onLogout() {
    try {
      await logout();
    } catch {
      // still leave
    }
    router.replace("/admin/login");
  }

  if (!ready || !me) {
    return (
      <div className="admin-shell flex min-h-screen items-center justify-center text-muted">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 animate-pulse rounded-2xl bg-forest/20" />
          <p className="mt-4 text-sm">ড্যাশবোর্ড প্রস্তুত হচ্ছে…</p>
        </div>
      </div>
    );
  }

  const nav = (
    <nav className="flex flex-col gap-1 p-3">
      {NAV.map((item) => {
        const active =
          item.href === "/admin"
            ? pathname === "/admin"
            : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold transition ${
              active
                ? "bg-forest text-white shadow-sm"
                : "text-muted hover:bg-white hover:text-forest"
            }`}
          >
            <span className="w-5 text-center opacity-70">{item.icon}</span>
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div className="admin-shell min-h-screen lg:grid lg:grid-cols-[240px_1fr]">
      <aside className="hidden border-r border-border bg-white/80 backdrop-blur-md lg:flex lg:flex-col">
        <div className="flex items-center gap-3 border-b border-border px-5 py-5">
          <Image src="/icon.png" alt="" width={36} height={36} className="rounded-lg" />
          <div>
            <p className="font-display text-lg leading-none text-forest">আরণ্য</p>
            <p className="mt-1 text-[11px] font-semibold tracking-wide text-muted uppercase">
              Admin
            </p>
          </div>
        </div>
        {nav}
        <div className="mt-auto border-t border-border p-4">
          <p className="truncate text-sm font-semibold text-ink">{me.displayName}</p>
          <p className="truncate text-xs text-muted">{me.role.nameBn}</p>
          <div className="mt-3 flex gap-2">
            <Link href="/" className="btn btn-ghost !min-h-8 flex-1 !px-2 text-xs">
              সাইট
            </Link>
            <button
              type="button"
              onClick={onLogout}
              className="btn btn-ghost !min-h-8 flex-1 !px-2 text-xs"
            >
              লগ আউট
            </button>
          </div>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-border bg-white/90 backdrop-blur-md lg:hidden">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <button
              type="button"
              className="btn btn-ghost !min-h-9 !px-3 text-sm"
              onClick={() => setMobileOpen((v) => !v)}
            >
              মেনু
            </button>
            <p className="font-display text-lg text-forest">আরণ্য অ্যাডমিন</p>
            <button
              type="button"
              onClick={onLogout}
              className="btn btn-ghost !min-h-9 !px-3 text-sm"
            >
              লগ আউট
            </button>
          </div>
          {mobileOpen ? <div className="border-t border-border bg-panel">{nav}</div> : null}
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

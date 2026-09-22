"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { getMe, logout } from "@/lib/api";
import { isStaff, type AuthUser } from "@/lib/types";

const NAV = [
  { href: "/admin", label: "সারাংশ" },
  { href: "/admin/users", label: "ব্যবহারকারী" },
  { href: "/admin/create", label: "অ্যাডমিন তৈরি" },
];

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

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
      <div className="flex min-h-screen items-center justify-center bg-sand text-muted">
        লোড হচ্ছে…
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-sand">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3">
          <div className="flex items-center gap-3">
            <Image src="/icon.png" alt="" width={36} height={36} className="rounded-lg" />
            <div>
              <p className="font-display text-xl leading-none text-forest">আরণ্য অ্যাডমিন</p>
              <p className="text-xs text-muted">
                {me.displayName} · {me.role.nameBn}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/" className="btn btn-ghost !min-h-9 !px-3 text-sm">
              সাইট
            </Link>
            <button type="button" onClick={onLogout} className="btn btn-ghost !min-h-9 !px-3 text-sm">
              লগ আউট
            </button>
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-5 pb-3">
          {NAV.map((item) => {
            const active =
              item.href === "/admin"
                ? pathname === "/admin"
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-4 py-2 text-sm font-semibold whitespace-nowrap ${
                  active
                    ? "bg-forest text-white"
                    : "text-muted hover:bg-white hover:text-forest"
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
      </header>
      <main className="mx-auto max-w-6xl px-5 py-8">{children}</main>
    </div>
  );
}

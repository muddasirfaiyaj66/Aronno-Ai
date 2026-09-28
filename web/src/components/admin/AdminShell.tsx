"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { getMe, logout } from "@/lib/api";
import { isStaff, type AuthUser } from "@/lib/types";

const NAV = [
  { href: "/admin", label: "Overview", mark: "OV" },
  { href: "/admin/market", label: "Market", mark: "MK" },
  { href: "/admin/reports", label: "Reports", mark: "RP" },
  { href: "/admin/payouts", label: "Payouts", mark: "PO" },
  { href: "/admin/delivery", label: "Delivery", mark: "DL" },
  { href: "/admin/users", label: "Users", mark: "US" },
  { href: "/admin/notifications", label: "Alerts", mark: "AL" },
  { href: "/admin/create", label: "New admin", mark: "AD" },
];

const THEME_KEY = "aronno.admin.theme";
const SIDE_KEY = "aronno.admin.sidebar";

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");
  const [clock, setClock] = useState("");

  useEffect(() => {
    const savedTheme = window.localStorage.getItem(THEME_KEY);
    const savedSide = window.localStorage.getItem(SIDE_KEY);
    if (savedTheme === "dark" || savedTheme === "light") setTheme(savedTheme);
    if (savedSide === "closed") setCollapsed(true);
  }, []);

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

  useEffect(() => {
    const tick = () =>
      setClock(
        new Date().toLocaleTimeString("en-GB", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        }),
      );
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, []);

  function toggleSide() {
    setCollapsed((value) => {
      const next = !value;
      window.localStorage.setItem(SIDE_KEY, next ? "closed" : "open");
      return next;
    });
  }

  function toggleTheme() {
    setTheme((value) => {
      const next = value === "dark" ? "light" : "dark";
      window.localStorage.setItem(THEME_KEY, next);
      return next;
    });
  }

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
      <div className="admin-shell flex min-h-screen items-center justify-center">
        <div className="text-center">
          <div className="live-dot mx-auto" />
          <p className="mt-4 text-sm text-muted">Opening the monitor…</p>
        </div>
      </div>
    );
  }

  const current = NAV.find((item) =>
    item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href),
  );

  const nav = (
    <nav className="flex flex-col gap-1 p-3">
      {NAV.map((item) => {
        const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            title={item.label}
            className={`admin-nav-link flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${
              active ? "active" : ""
            }`}
          >
            <span className="w-7 shrink-0 text-center text-[11px] tracking-wide">{item.mark}</span>
            <span className={collapsed ? "lg:hidden" : ""}>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );

  return (
    <div
      data-theme={theme}
      className={`admin-shell min-h-screen lg:grid ${collapsed ? "lg:grid-cols-[84px_1fr]" : "lg:grid-cols-[248px_1fr]"}`}
    >
      <aside className="admin-side hidden lg:flex lg:flex-col">
        <div className={`flex items-center gap-3 px-4 py-5 ${collapsed ? "justify-center" : ""}`}>
          <Image src="/icon.png" alt="" width={36} height={36} className="rounded-lg" />
          {collapsed ? null : (
            <div>
              <p className="text-lg leading-none font-semibold">Aronno</p>
              <p className="mt-1 flex items-center gap-2 text-[11px] font-semibold tracking-[0.16em] uppercase opacity-70">
                <span className="live-dot" /> Monitor
              </p>
            </div>
          )}
        </div>
        {nav}
        <div className="mt-auto border-t border-current/10 p-3">
          {collapsed ? (
            <button type="button" onClick={onLogout} className="w-full py-2 text-xs font-semibold" title="Log out">
              Out
            </button>
          ) : (
            <>
              <p className="truncate px-1 text-sm font-semibold">{me.displayName}</p>
              <p className="truncate px-1 text-xs opacity-70">{me.role.slug}</p>
              <p className="mt-2 px-1 font-mono text-xs opacity-70">{clock}</p>
              <div className="mt-3 flex gap-2">
                <Link href="/" className="btn btn-ghost !min-h-8 flex-1 !px-2 text-xs">
                  Site
                </Link>
                <button type="button" onClick={onLogout} className="btn btn-ghost !min-h-8 flex-1 !px-2 text-xs">
                  Log out
                </button>
              </div>
            </>
          )}
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-20 border-b border-border bg-[var(--white)]/90 backdrop-blur-md">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="flex items-center gap-2">
              <button type="button" className="btn btn-ghost !hidden !min-h-9 !px-3 text-sm lg:!inline-flex" onClick={toggleSide}>
                {collapsed ? "Open" : "Close"}
              </button>
              <button
                type="button"
                className="btn btn-ghost !min-h-9 !px-3 text-sm lg:hidden"
                onClick={() => setMobileOpen((value) => !value)}
              >
                Menu
              </button>
              <p className="text-sm font-semibold text-ink">{current?.label ?? "Monitor"}</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="hidden sm:block">
                <span className="sr-only">Jump to</span>
                <select
                  className="field !min-h-9 !w-40 !py-1 text-sm"
                  value={current?.href ?? "/admin"}
                  onChange={(event) => router.push(event.target.value)}
                >
                  {NAV.map((item) => (
                    <option key={item.href} value={item.href}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              <button type="button" className="btn btn-ghost !min-h-9 !px-3 text-sm" onClick={toggleTheme}>
                {theme === "dark" ? "Light" : "Dark"}
              </button>
              <button type="button" onClick={onLogout} className="btn btn-ghost !min-h-9 !px-3 text-sm lg:hidden">
                Log out
              </button>
            </div>
          </div>
          {mobileOpen ? <div className="border-t border-border lg:hidden">{nav}</div> : null}
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

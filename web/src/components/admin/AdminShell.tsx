"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { getMe, logout } from "@/lib/api";
import { isStaff, type AuthUser } from "@/lib/types";

const GROUPS = [
  {
    label: "Monitor",
    items: [{ href: "/admin", label: "Overview", icon: "overview" }],
  },
  {
    label: "Commerce",
    items: [
      { href: "/admin/market", label: "Market", icon: "market" },
      { href: "/admin/payouts", label: "Payouts", icon: "payout" },
      { href: "/admin/delivery", label: "Delivery", icon: "delivery" },
      { href: "/admin/reports", label: "Reports", icon: "reports" },
    ],
  },
  {
    label: "Access",
    items: [
      { href: "/admin/users", label: "Users", icon: "users" },
      { href: "/admin/specialists", label: "Specialists", icon: "specialists" },
      { href: "/admin/notifications", label: "Alerts", icon: "alerts" },
      { href: "/admin/create", label: "New admin", icon: "admin" },
    ],
  },
] as const;

type NavItem = (typeof GROUPS)[number]["items"][number];

const NAV: readonly NavItem[] = GROUPS.flatMap((group) => [...group.items]);

const THEME_KEY = "aronno.admin.theme";
const SIDE_KEY = "aronno.admin.sidebar";

function Glyph({ name }: { name: string }) {
  const common = {
    viewBox: "0 0 24 24",
    className: "h-[18px] w-[18px] shrink-0",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.75,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
  };
  if (name === "overview") {
    return (
      <svg {...common}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
      </svg>
    );
  }
  if (name === "market") {
    return (
      <svg {...common}>
        <path d="M4 10h16l-1.2 9H5.2L4 10Z" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </svg>
    );
  }
  if (name === "payout") {
    return (
      <svg {...common}>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <path d="M3 10h18" />
      </svg>
    );
  }
  if (name === "delivery") {
    return (
      <svg {...common}>
        <path d="M3 7h11v10H3z" />
        <path d="M14 11h4l3 3v3h-7" />
        <circle cx="7" cy="18" r="1.5" />
        <circle cx="17" cy="18" r="1.5" />
      </svg>
    );
  }
  if (name === "reports") {
    return (
      <svg {...common}>
        <path d="M7 3h7l5 5v13a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" />
        <path d="M14 3v5h5M8 13h8M8 17h5" />
      </svg>
    );
  }
  if (name === "users") {
    return (
      <svg {...common}>
        <circle cx="9" cy="8" r="3" />
        <path d="M3.5 19a5.5 5.5 0 0 1 11 0" />
        <circle cx="17" cy="9" r="2.2" />
        <path d="M16 19a4.5 4.5 0 0 1 4.5-4" />
      </svg>
    );
  }
  if (name === "specialists") {
    return (
      <svg {...common}>
        <circle cx="12" cy="8" r="3" />
        <path d="M5.5 19a6.5 6.5 0 0 1 13 0" />
        <path d="M16.5 4.5 17.6 6.7 20 7l-1.8 1.6.5 2.3-2.2-1.2-2.2 1.2.5-2.3L13 7l2.4-.3Z" />
      </svg>
    );
  }
  if (name === "alerts") {
    return (
      <svg {...common}>
        <path d="M6 16V10a6 6 0 1 1 12 0v6l1.5 2H4.5L6 16Z" />
        <path d="M10 19a2 2 0 0 0 4 0" />
      </svg>
    );
  }
  if (name === "menu") {
    return (
      <svg {...common}>
        <path d="M4 7h16M4 12h16M4 17h16" />
      </svg>
    );
  }
  if (name === "panel") {
    return (
      <svg {...common}>
        <rect x="3" y="4" width="18" height="16" rx="2" />
        <path d="M9 4v16" />
      </svg>
    );
  }
  if (name === "sun") {
    return (
      <svg {...common}>
        <circle cx="12" cy="12" r="3.5" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4" />
      </svg>
    );
  }
  if (name === "moon") {
    return (
      <svg {...common}>
        <path d="M16 3.5A8.5 8.5 0 1 0 20.5 14 7 7 0 0 1 16 3.5Z" />
      </svg>
    );
  }
  if (name === "logout") {
    return (
      <svg {...common}>
        <path d="M10 7V5a2 2 0 0 1 2-2h7v18h-7a2 2 0 0 1-2-2v-2" />
        <path d="M4 12h10M11 9l3 3-3 3" />
      </svg>
    );
  }
  return (
    <svg {...common}>
      <circle cx="12" cy="8" r="3" />
      <path d="M5 19a7 7 0 0 1 14 0" />
      <path d="M16 6h5M18.5 3.5v5" />
    </svg>
  );
}

export function AdminShell({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [me, setMe] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

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
        <p className="text-sm text-muted">Opening the monitor…</p>
      </div>
    );
  }

  const current = NAV.find((item) =>
    item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href),
  );

  const nav = (
    <div className="flex flex-1 flex-col gap-6 overflow-y-auto px-3 py-4">
      {GROUPS.map((group) => (
        <div key={group.label}>
          <p className={`mb-2 px-3 text-[11px] font-semibold tracking-[0.14em] text-muted uppercase ${collapsed ? "lg:hidden" : ""}`}>
            {group.label}
          </p>
          <nav className="flex flex-col gap-0.5">
            {group.items.map((item) => {
              const active = item.href === "/admin" ? pathname === "/admin" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={item.label}
                  className={`admin-nav-link flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium ${active ? "active" : ""}`}
                >
                  <Glyph name={item.icon} />
                  <span className={collapsed ? "lg:hidden" : ""}>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>
      ))}
    </div>
  );

  return (
    <div
      data-theme={theme}
      className={`admin-shell min-h-screen lg:grid ${collapsed ? "lg:grid-cols-[76px_1fr]" : "lg:grid-cols-[248px_1fr]"}`}
    >
      <aside className="admin-side hidden lg:flex lg:flex-col">
        <div className={`flex h-16 items-center gap-3 border-b border-border px-4 ${collapsed ? "justify-center" : ""}`}>
          <Image src="/icon.png" alt="" width={28} height={28} className="rounded-md" />
          {collapsed ? null : <p className="text-[15px] font-semibold tracking-tight">Aronno</p>}
        </div>
        {nav}
        <div className="border-t border-border p-3">
          {collapsed ? (
            <button type="button" onClick={onLogout} className="admin-icon-btn mx-auto" title="Log out" aria-label="Log out">
              <Glyph name="logout" />
            </button>
          ) : (
            <div className="flex items-center gap-3 px-1">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-panel text-xs font-semibold text-forest">
                {me.displayName.slice(0, 1).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{me.displayName}</p>
                <p className="truncate text-xs text-muted">{me.role.slug}</p>
              </div>
              <button type="button" onClick={onLogout} className="text-xs font-semibold text-muted hover:text-ink" title="Log out">
                Log out
              </button>
            </div>
          )}
        </div>
      </aside>

      <div className="min-w-0">
        <header className="admin-top sticky top-0 z-20">
          <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6">
            <div className="flex min-w-0 items-center gap-2">
              <button type="button" className="admin-icon-btn hidden lg:inline-flex" onClick={toggleSide} aria-label={collapsed ? "Open sidebar" : "Close sidebar"}>
                <Glyph name="panel" />
              </button>
              <button type="button" className="admin-icon-btn lg:hidden" onClick={() => setMobileOpen((value) => !value)} aria-label="Menu">
                <Glyph name="menu" />
              </button>
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-ink">{current?.label ?? "Monitor"}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <label className="hidden md:block">
                <span className="sr-only">Jump to</span>
                <select
                  className="field !h-9 !min-h-0 !w-40 !py-0 text-sm"
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
              <button type="button" className="admin-icon-btn" onClick={toggleTheme} aria-label={theme === "dark" ? "Switch to light" : "Switch to dark"}>
                <Glyph name={theme === "dark" ? "sun" : "moon"} />
              </button>
              <Link href="/" className="btn btn-ghost !h-9 !min-h-0 !px-3 text-sm">
                Site
              </Link>
            </div>
          </div>
          {mobileOpen ? <div className="border-t border-border bg-[var(--white)] lg:hidden">{nav}</div> : null}
        </header>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}

import Image from "next/image";
import Link from "next/link";
import { ReactNode } from "react";

const NAV = [
  { href: "/heatmap", label: "হিট ম্যাপ" },
  { href: "/market", label: "বাজার" },
  { href: "/#capabilities", label: "সক্ষমতা" },
];

export function PublicHeader({ solid = false }: { solid?: boolean }) {
  return (
    <header
      className={
        solid
          ? "sticky top-0 z-40 border-b border-border bg-white/92 backdrop-blur-md"
          : "absolute inset-x-0 top-0 z-30"
      }
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
        <Link
          href="/"
          className={`flex items-center gap-3 ${solid ? "text-forest" : "text-sand"}`}
        >
          <Image
            src="/icon.png"
            alt=""
            width={36}
            height={36}
            className={`rounded-lg ${solid ? "" : "ring-1 ring-white/20"}`}
            priority
          />
          <span className="font-display text-2xl tracking-tight">আরণ্য</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`hidden px-3 py-2 text-sm font-medium transition sm:inline ${
                solid
                  ? "text-muted hover:text-forest"
                  : "text-sand/75 hover:text-sand"
              }`}
            >
              {item.label}
            </Link>
          ))}
          <Link
            href="/admin/login"
            className={
              solid
                ? "btn btn-ghost !min-h-9 !px-3 text-sm"
                : "rounded-lg border border-white/20 bg-white/8 px-4 py-2 text-sm font-semibold text-sand backdrop-blur-sm transition hover:bg-white/15"
            }
          >
            প্রশাসক
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function PublicFooter() {
  return (
    <footer className="border-t border-white/10 bg-forest-deep text-sand">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="font-display text-3xl text-leaf">আরণ্য</p>
          <p className="mt-1 text-xs font-semibold tracking-[0.16em] text-sand/45 uppercase">
            Aronno
          </p>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-sand/65">
            বাংলাদেশের কৃষকদের জন্য অন‑ডিভাইস কৃষি সহায়ক — রোগ শনাক্তকরণ, সার
            নির্দেশনা, আবহাওয়া ও বাজার তথ্য।
          </p>
        </div>
        <div className="flex flex-col gap-2 text-sm md:items-end md:text-right">
          <Link href="/heatmap" className="text-sand/70 hover:text-sand">
            রোগের হিট ম্যাপ
          </Link>
          <Link href="/market" className="text-sand/70 hover:text-sand">
            কৃষি বাজার
          </Link>
          <Link href="/admin/login" className="font-semibold text-leaf hover:underline">
            প্রশাসক লগইন
          </Link>
          <p className="mt-4 text-xs text-sand/40">
            © {new Date().getFullYear()} Aronno. সর্বস্বত্ব সংরক্ষিত।
          </p>
        </div>
      </div>
    </footer>
  );
}

export function PublicShell({
  children,
  title,
  subtitle,
}: {
  children: ReactNode;
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="site-canvas min-h-screen">
      <PublicHeader solid />
      <main className="mx-auto max-w-6xl px-5 py-10 md:py-14">
        <div className="max-w-2xl">
          <h1 className="font-display text-3xl text-forest md:text-5xl">{title}</h1>
          {subtitle ? (
            <p className="mt-3 text-lg leading-relaxed text-muted">{subtitle}</p>
          ) : null}
        </div>
        <div className="mt-10">{children}</div>
      </main>
      <PublicFooter />
    </div>
  );
}

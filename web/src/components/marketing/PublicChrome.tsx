import Image from "next/image";
import Link from "next/link";
import { ReactNode } from "react";

const NAV = [
  { href: "/", label: "হোম" },
  { href: "/heatmap", label: "হিট ম্যাপ" },
  { href: "/market", label: "বাজার" },
  { href: "/#device", label: "মাটি সেন্সর" },
];

export function PublicHeader({ solid = false }: { solid?: boolean }) {
  return (
    <header
      className={
        solid
          ? "site-header border-b border-border bg-white/95 backdrop-blur-md"
          : "site-header border-b border-white/10 bg-forest-deep/80 text-sand backdrop-blur-md"
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
        <nav className={`hidden items-center gap-1 rounded-full p-1 md:flex ${solid ? "border border-border bg-white" : "bg-white/10"}`}>
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                solid
                  ? "text-muted hover:bg-sand hover:text-forest"
                  : "text-sand/80 hover:bg-white/10 hover:text-sand"
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Link
          href="/admin/login"
          className={
            solid
              ? "btn btn-primary !min-h-10 !px-4 text-sm"
              : "rounded-lg border border-white/20 bg-white/8 px-4 py-2 text-sm font-semibold text-sand backdrop-blur-sm transition hover:bg-white/15"
          }
        >
          প্রশাসক
        </Link>
      </div>
      <nav className="flex gap-2 overflow-x-auto px-5 pb-3 md:hidden">
        {NAV.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-medium ${
              solid ? "bg-sand text-forest" : "bg-white/10 text-sand"
            }`}
          >
            {item.label}
          </Link>
        ))}
      </nav>
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
            বাংলাদেশের কৃষকদের জন্য রোগ শনাক্তকরণ, মাটি পরীক্ষা, আবহাওয়া ও বাজার।
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
      <main className="mx-auto max-w-6xl px-5 py-8 md:px-6 md:py-12">
        <p className="section-label">আরণ্য</p>
        <h1 className="mt-2 max-w-3xl font-display text-4xl text-forest md:text-5xl">{title}</h1>
        {subtitle ? <p className="mt-3 max-w-2xl text-lg leading-relaxed text-muted">{subtitle}</p> : null}
        <div className="mt-8">{children}</div>
      </main>
      <PublicFooter />
    </div>
  );
}

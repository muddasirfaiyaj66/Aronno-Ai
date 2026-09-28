import Image from "next/image";
import Link from "next/link";

const LINKS = [
  { href: "/heatmap", label: "হিট ম্যাপ" },
  { href: "/market", label: "বাজার" },
  { href: "/#capabilities", label: "সক্ষমতা" },
  { href: "/#device", label: "মাটি সেন্সর" },
];

export function SiteHeader() {
  return (
    <header className="site-header border-b border-border bg-sand/95 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-3 md:px-6">
        <Link href="/" className="flex items-center gap-3 text-forest">
          <Image src="/icon.png" alt="" width={36} height={36} className="rounded-lg" priority />
          <span className="font-display text-2xl leading-none tracking-tight">আরণ্য</span>
        </Link>
        <nav className="hidden items-center gap-1 rounded-full border border-border bg-white/80 p-1 md:flex">
          {LINKS.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full px-3.5 py-1.5 text-sm font-medium text-muted transition hover:bg-sand hover:text-forest"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <Link href="/admin/login" className="btn btn-primary !min-h-10 !px-4 text-sm">
          প্রশাসক
        </Link>
      </div>
      <nav className="flex gap-2 overflow-x-auto px-5 pb-3 md:hidden">
        {LINKS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="shrink-0 rounded-full border border-border bg-white px-3 py-1.5 text-sm font-medium text-forest"
          >
            {item.label}
          </Link>
        ))}
      </nav>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="bg-forest-deep text-sand">
      <div className="mx-auto grid max-w-6xl gap-10 px-5 py-14 md:grid-cols-[1.4fr_1fr_1fr] md:px-6">
        <div>
          <p className="font-display text-4xl leading-none">আরণ্য</p>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-sand/65">
            বাংলাদেশের কৃষকদের জন্য রোগ শনাক্তকরণ, মাটি পরীক্ষা, আবহাওয়া ও বাজার — একই জায়গায়।
          </p>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <p className="text-xs font-semibold tracking-[0.14em] text-sand/40 uppercase">দেখুন</p>
          <Link href="/heatmap" className="text-sand/80 hover:text-sand">রোগের হিট ম্যাপ</Link>
          <Link href="/market" className="text-sand/80 hover:text-sand">কৃষি বাজার</Link>
          <Link href="/#device" className="text-sand/80 hover:text-sand">মাটি সেন্সর</Link>
        </div>
        <div className="flex flex-col gap-2 text-sm">
          <p className="text-xs font-semibold tracking-[0.14em] text-sand/40 uppercase">দল</p>
          <Link href="/admin/login" className="font-semibold text-leaf hover:underline">প্রশাসক লগইন</Link>
          <p className="mt-4 text-xs text-sand/40">© {new Date().getFullYear()} Aronno</p>
        </div>
      </div>
    </footer>
  );
}

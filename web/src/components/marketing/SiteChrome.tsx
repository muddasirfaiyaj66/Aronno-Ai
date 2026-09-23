import Image from "next/image";
import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-40">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-6 md:px-6">
        <Link href="/" className="group flex items-center gap-3 text-sand">
          <Image
            src="/icon.png"
            alt=""
            width={40}
            height={40}
            className="rounded-[0.7rem] ring-1 ring-white/25 transition group-hover:ring-white/40"
            priority
          />
          <span className="font-display text-[1.65rem] leading-none tracking-tight">
            আরণ্য
          </span>
        </Link>
        <nav className="flex items-center gap-0.5 sm:gap-1">
          <Link
            href="/heatmap"
            className="hidden rounded-lg px-3.5 py-2 text-[0.9rem] font-medium text-sand/70 transition hover:bg-white/8 hover:text-sand sm:inline"
          >
            হিট ম্যাপ
          </Link>
          <Link
            href="/market"
            className="hidden rounded-lg px-3.5 py-2 text-[0.9rem] font-medium text-sand/70 transition hover:bg-white/8 hover:text-sand sm:inline"
          >
            বাজার
          </Link>
          <a
            href="#capabilities"
            className="hidden rounded-lg px-3.5 py-2 text-[0.9rem] font-medium text-sand/70 transition hover:bg-white/8 hover:text-sand md:inline"
          >
            সক্ষমতা
          </a>
          <Link
            href="/admin/login"
            className="ml-1 rounded-lg border border-white/20 bg-white/[0.07] px-3.5 py-2 text-[0.9rem] font-semibold text-sand backdrop-blur-sm transition hover:bg-white/14"
          >
            প্রশাসক
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-white/10 bg-forest-deep text-sand">
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 md:grid-cols-[1.5fr_1fr] md:px-6">
        <div>
          <p className="font-display text-4xl leading-none text-leaf">আরণ্য</p>
          <p className="mt-2 text-[0.7rem] font-semibold tracking-[0.2em] text-sand/40 uppercase">
            Aronno
          </p>
          <p className="mt-5 max-w-md text-[0.95rem] leading-relaxed text-sand/60">
            বাংলাদেশের কৃষকদের জন্য অন‑ডিভাইস কৃষি সহায়ক — রোগ শনাক্তকরণ থেকে
            বাজার তথ্য পর্যন্ত, মাঠেই।
          </p>
        </div>
        <div className="flex flex-col gap-3 text-[0.95rem] md:items-end md:text-right">
          <Link href="/heatmap" className="text-sand/65 transition hover:text-sand">
            রোগের হিট ম্যাপ
          </Link>
          <Link href="/market" className="text-sand/65 transition hover:text-sand">
            কৃষি বাজার
          </Link>
          <Link
            href="/admin/login"
            className="font-semibold text-leaf transition hover:underline"
          >
            প্রশাসক লগইন
          </Link>
          <p className="mt-6 text-xs text-sand/35">
            © {new Date().getFullYear()} Aronno
          </p>
        </div>
      </div>
    </footer>
  );
}

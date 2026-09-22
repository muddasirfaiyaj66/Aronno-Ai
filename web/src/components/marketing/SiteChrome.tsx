import Image from "next/image";
import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="relative z-20 border-b border-border/70 bg-sand/80 backdrop-blur-md">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-4">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/icon.png"
            alt=""
            width={40}
            height={40}
            className="rounded-xl"
            priority
          />
          <span className="font-display text-2xl text-forest">আরণ্য</span>
        </Link>
        <nav className="flex items-center gap-2 sm:gap-3">
          <a href="#features" className="hidden px-3 py-2 text-sm font-semibold text-muted sm:inline">
            সুবিধা
          </a>
          <a href="#how" className="hidden px-3 py-2 text-sm font-semibold text-muted sm:inline">
            কীভাবে
          </a>
          <Link href="/admin/login" className="btn btn-ghost !min-h-10 !px-4 text-sm">
            অ্যাডমিন
          </Link>
        </nav>
      </div>
    </header>
  );
}

export function SiteFooter() {
  return (
    <footer className="border-t border-border bg-forest-deep text-sand">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-5 py-10 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-display text-3xl text-leaf">আরণ্য</p>
          <p className="mt-2 max-w-md text-sm text-sand/75">
            বাংলাদেশের কৃষকদের জন্য অন‑ডিভাইস এআই সহকারী — রোগ, সার, আবহাওয়া ও বাজার।
          </p>
        </div>
        <Link href="/admin/login" className="text-sm font-semibold text-leaf hover:underline">
          অ্যাডমিন লগইন
        </Link>
      </div>
    </footer>
  );
}

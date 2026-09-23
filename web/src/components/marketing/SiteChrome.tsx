import Image from "next/image";
import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="absolute inset-x-0 top-0 z-30">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-5 py-5">
        <Link href="/" className="flex items-center gap-3 text-sand">
          <Image
            src="/icon.png"
            alt=""
            width={38}
            height={38}
            className="rounded-lg ring-1 ring-white/20"
            priority
          />
          <span className="font-display text-2xl tracking-tight">আরণ্য</span>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <a
            href="#features"
            className="hidden px-3 py-2 text-sm font-medium text-sand/75 transition hover:text-sand sm:inline"
          >
            সক্ষমতা
          </a>
          <a
            href="#how"
            className="hidden px-3 py-2 text-sm font-medium text-sand/75 transition hover:text-sand sm:inline"
          >
            ব্যবহার
          </a>
          <a
            href="#team"
            className="hidden px-3 py-2 text-sm font-medium text-sand/75 transition hover:text-sand md:inline"
          >
            পরিচালনা
          </a>
          <Link
            href="/admin/login"
            className="rounded-lg border border-white/20 bg-white/8 px-4 py-2 text-sm font-semibold text-sand backdrop-blur-sm transition hover:bg-white/15"
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
        <div className="flex flex-col justify-between gap-6 sm:flex-row md:flex-col md:items-end md:text-right">
          <div className="flex flex-col gap-2 text-sm">
            <a href="#features" className="text-sand/70 hover:text-sand">
              সক্ষমতা
            </a>
            <a href="#how" className="text-sand/70 hover:text-sand">
              ব্যবহার পদ্ধতি
            </a>
            <Link href="/admin/login" className="font-semibold text-leaf hover:underline">
              প্রশাসক লগইন
            </Link>
          </div>
          <p className="text-xs text-sand/40">
            © {new Date().getFullYear()} Aronno. সর্বস্বত্ব সংরক্ষিত।
          </p>
        </div>
      </div>
    </footer>
  );
}

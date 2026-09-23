import Image from "next/image";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/marketing/SiteChrome";

const CAPABILITIES = [
  {
    title: "রোগ শনাক্তকরণ",
    body: "পাতার ছবি থেকে সম্ভাব্য রোগ ও পরবর্তী পদক্ষেপ — বাংলায়, স্পষ্ট ভাষায়।",
  },
  {
    title: "কণ্ঠ ও লেখার পরামর্শ",
    body: "জিজ্ঞাসা বলুন বা লিখুন। নেট দুর্বল হলেও অন‑ডিভাইস মডেল সাহায্য করে।",
  },
  {
    title: "সার, আবহাওয়া, বাজার",
    body: "সার নির্দেশনা, আবহাওয়া সতর্কতা এবং স্থানীয় দাম — একই অ্যাপে।",
  },
];

const STEPS = [
  {
    n: "০১",
    title: "স্ক্যান খুলুন",
    body: "মোবাইল অ্যাপের স্ক্যান বিভাগে যান।",
  },
  {
    n: "০২",
    title: "ছবি বা প্রশ্ন দিন",
    body: "পাতা তুলুন, অথবা কণ্ঠে/লেখায় সমস্যা জানান।",
  },
  {
    n: "০৩",
    title: "নির্দেশনা নিন",
    body: "রোগ, চিকিৎসা ও সতর্কতা বাংলায় পড়ুন বা শুনুন।",
  },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-sand">
      <main>
        <section className="hero-field relative min-h-[100svh] overflow-hidden text-sand">
          <Image
            src="/hero-field.jpg"
            alt=""
            fill
            priority
            sizes="100vw"
            className="hero-photo object-cover object-[center_40%]"
          />
          <div className="hero-veil" aria-hidden />
          <div className="hero-grain" aria-hidden />
          <div className="hero-glow" aria-hidden />
          <div className="hero-horizon" aria-hidden />
          <SiteHeader />

          <div className="relative z-10 mx-auto flex min-h-[100svh] max-w-6xl flex-col justify-end px-5 pb-16 pt-28 sm:pb-20 sm:pt-32 md:px-6 md:pb-24">
            <div className="rise-in max-w-[40rem] [text-shadow:0_2px_28px_rgba(7,31,24,0.45)]">
              <p className="font-display text-[clamp(4.5rem,14vw,8.75rem)] leading-[0.88] tracking-[-0.03em]">
                আরণ্য
              </p>
              <p className="mt-4 text-[0.7rem] font-semibold tracking-[0.28em] text-sand/55 uppercase">
                Aronno · Bangladesh
              </p>
            </div>

            <div className="rise-in-delay mt-10 max-w-xl [text-shadow:0_2px_20px_rgba(7,31,24,0.5)] md:mt-12">
              <h1 className="text-[clamp(1.35rem,3.2vw,1.85rem)] font-semibold leading-[1.4] text-sand">
                মাঠের সিদ্ধান্ত — নির্ভরযোগ্য কৃষি সহায়তা, বাংলায়।
              </h1>
              <p className="mt-4 max-w-md text-[1.05rem] leading-relaxed text-sand/75">
                রোগ শনাক্তকরণ, সার ও স্প্রে নির্দেশনা, আবহাওয়া ও বাজার — অফলাইনও
                কাজ করে।
              </p>
            </div>

            <div className="rise-in-late mt-9 flex flex-wrap gap-3">
              <Link
                href="/heatmap"
                className="btn !min-h-[3.15rem] !bg-sand !px-6 !text-forest-deep hover:!bg-white"
              >
                হিট ম্যাপ খুলুন
              </Link>
              <Link
                href="/market"
                className="btn !min-h-[3.15rem] border border-white/25 !bg-transparent !px-6 !text-sand hover:!bg-white/10"
              >
                বাজার দেখুন
              </Link>
            </div>
          </div>
        </section>

        <section id="capabilities" className="bg-sand">
          <div className="mx-auto max-w-6xl px-5 py-20 md:px-6 md:py-28">
            <div className="max-w-2xl">
              <p className="section-label">সক্ষমতা</p>
              <h2 className="mt-4 font-display text-[clamp(1.85rem,4vw,3rem)] text-forest">
                ক্ষেতের কাজের ধাপে ধাপে সহায়তা
              </h2>
              <p className="mt-4 max-w-lg text-lg leading-relaxed text-muted">
                জটিল ড্যাশবোর্ড নয় — কৃষক যা করেন, সেই মুহূর্তেই প্রয়োজনীয়
                উত্তর।
              </p>
            </div>

            <div className="mt-16 grid gap-0 md:grid-cols-3">
              {CAPABILITIES.map((item, i) => (
                <article
                  key={item.title}
                  className={`border-forest/25 pt-7 md:border-t-0 md:pt-0 md:pl-8 ${
                    i === 0
                      ? "border-t md:border-t md:pl-0 md:pr-8"
                      : "border-t md:border-l"
                  }`}
                >
                  <h3 className="text-xl font-semibold tracking-tight text-ink">
                    {item.title}
                  </h3>
                  <p className="mt-3 max-w-sm leading-relaxed text-muted">
                    {item.body}
                  </p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="border-y border-border bg-white">
          <div className="mx-auto max-w-6xl px-5 py-20 md:px-6 md:py-28">
            <div className="max-w-2xl">
              <p className="section-label">ব্যবহার</p>
              <h2 className="mt-4 font-display text-[clamp(1.85rem,4vw,3rem)] text-forest">
                তিন ধাপে শুরু
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-muted">
                অ্যান্ড্রয়েড অ্যাপে স্ক্যান করে শুরু করুন — ছবি, কণ্ঠ বা লেখায়।
              </p>
            </div>

            <ol className="mt-16 grid gap-12 md:grid-cols-3 md:gap-10">
              {STEPS.map((s) => (
                <li key={s.n} className="relative">
                  <span className="font-display text-[2.75rem] leading-none text-leaf/75">
                    {s.n}
                  </span>
                  <h3 className="mt-5 text-xl font-semibold tracking-tight text-ink">
                    {s.title}
                  </h3>
                  <p className="mt-2 leading-relaxed text-muted">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section
          id="open"
          className="relative overflow-hidden bg-forest-deep text-sand"
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.18]"
            style={{
              backgroundImage:
                "radial-gradient(ellipse 70% 50% at 15% 20%, rgba(61,149,112,.9), transparent 55%), radial-gradient(ellipse 50% 40% at 90% 80%, rgba(154,100,24,.4), transparent 50%)",
            }}
          />
          <div className="relative mx-auto max-w-6xl px-5 py-20 md:px-6 md:py-28">
            <p className="text-[0.8125rem] font-semibold tracking-[0.14em] text-leaf/80 uppercase">
              উন্মুক্ত তথ্য
            </p>
            <h2 className="mt-4 max-w-2xl font-display text-[clamp(1.85rem,4vw,3.1rem)] leading-[1.15]">
              লগইন ছাড়াই দেশের রোগ মানচিত্র ও বাজার দেখুন।
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-sand/60">
              কৃষকদের স্ক্যান থেকে তৈরি হিট ম্যাপ, স্থানীয় দাম এবং তালিকাভুক্ত
              পণ্য — সবার জন্য।
            </p>

            <div className="mt-12 grid gap-8 border-t border-white/15 pt-10 sm:grid-cols-2">
              <Link
                href="/heatmap"
                className="group block transition hover:opacity-95"
              >
                <p className="text-sm font-semibold tracking-wide text-leaf">
                  OpenStreetMap
                </p>
                <p className="mt-2 font-display text-3xl leading-tight transition group-hover:text-leaf md:text-4xl">
                  রোগের হিট ম্যাপ →
                </p>
                <p className="mt-3 max-w-sm text-sand/55">
                  জেলাভিত্তিক প্রাদুর্ভাব — মানচিত্রে ক্লিক করে বিস্তারিত।
                </p>
              </Link>
              <Link
                href="/market"
                className="group block transition hover:opacity-95"
              >
                <p className="text-sm font-semibold tracking-wide text-leaf">
                  পাবলিক বাজার
                </p>
                <p className="mt-2 font-display text-3xl leading-tight transition group-hover:text-leaf md:text-4xl">
                  দাম ও পণ্য →
                </p>
                <p className="mt-3 max-w-sm text-sand/55">
                  বাজার দর, দোকান ও তালিকাভুক্ত কৃষি পণ্য এক নজরে।
                </p>
              </Link>
            </div>
          </div>
        </section>

        <section className="bg-sand">
          <div className="mx-auto max-w-6xl px-5 py-20 md:px-6 md:py-24">
            <div className="editorial-rule mb-12 max-w-xs" />
            <h2 className="max-w-2xl font-display text-[clamp(1.75rem,3.5vw,2.75rem)] text-forest">
              নেটওয়ার্ক দুর্বল হলেও কাজ চলে।
            </h2>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-muted">
              মূল মডেল ফোনেই চলে। সংযোগ ফিরলে তথ্য সিঙ্ক হয় — একই কেন্দ্রীয়
              সিস্টেমের সঙ্গে।
            </p>
          </div>
        </section>

        {/* ── Admin: quiet, secondary ── */}
        <section id="team" className="border-t border-border bg-white">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-8 px-5 py-14 md:flex-row md:items-center md:px-6 md:py-16">
            <div className="max-w-lg">
              <p className="section-label">পরিচালনা</p>
              <h2 className="mt-3 font-display text-2xl text-forest md:text-3xl">
                দলের জন্য প্রশাসনিক প্যানেল
              </h2>
              <p className="mt-3 leading-relaxed text-muted">
                ব্যবহারকারী ও বিশ্লেষণ — মোবাইল অ্যাপের একই API।
              </p>
            </div>
            <Link href="/admin/login" className="btn btn-ghost shrink-0">
              প্রশাসক প্রবেশ
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

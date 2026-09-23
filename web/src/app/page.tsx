import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/marketing/SiteChrome";

const FEATURES = [
  {
    title: "রোগ শনাক্তকরণ",
    body: "পাতার ছবি থেকে সম্ভাব্য রোগ নির্ধারণ এবং পরবর্তী পদক্ষেপ বাংলায় উপস্থাপন।",
  },
  {
    title: "কণ্ঠ ও লেখার পরামর্শ",
    body: "প্রশ্ন বলুন বা লিখুন। নেটওয়ার্ক দুর্বল হলেও অন‑ডিভাইস মডেল সাহায্য করে।",
  },
  {
    title: "সার, আবহাওয়া ও বাজার",
    body: "সার সুপারিশ, আবহাওয়া সতর্কতা এবং স্থানীয় দাম — একই কর্মপ্রবাহে।",
  },
];

const STEPS = [
  {
    n: "০১",
    title: "স্ক্যান শুরু করুন",
    body: "মোবাইল অ্যাপের স্ক্যান বিভাগে প্রবেশ করুন।",
  },
  {
    n: "০২",
    title: "ছবি তুলুন বা প্রশ্ন করুন",
    body: "পাতার ছবি নিন, অথবা কণ্ঠে/লেখায় সমস্যা জানান।",
  },
  {
    n: "০৩",
    title: "নির্দেশনা গ্রহণ করুন",
    body: "রোগ, চিকিৎসা ও সতর্কতা বাংলায় পড়ুন বা শুনুন।",
  },
];

export default function HomePage() {
  return (
    <div className="site-canvas min-h-screen">
      <main>
        <section className="hero-field relative min-h-[88vh] overflow-hidden text-sand">
          <div className="hero-sheen pointer-events-none absolute inset-0" />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.07]"
            style={{
              backgroundImage:
                "linear-gradient(rgba(255,255,255,.55) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.55) 1px, transparent 1px)",
              backgroundSize: "72px 72px",
              maskImage: "linear-gradient(180deg, black 20%, transparent 85%)",
            }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-0 left-0 right-0 h-36 bg-gradient-to-t from-sand to-transparent"
          />
          <SiteHeader />

          <div className="relative mx-auto flex min-h-[88vh] max-w-6xl flex-col justify-end px-5 pb-20 pt-28 sm:pb-24 sm:pt-32">
            <div className="rise-in max-w-3xl">
              <p className="font-display text-[4.75rem] leading-[0.92] tracking-tight sm:text-8xl md:text-[7.5rem]">
                আরণ্য
              </p>
              <p className="mt-3 text-sm font-semibold tracking-[0.18em] text-sand/55 uppercase">
                Aronno
              </p>
              <h1 className="mt-8 max-w-2xl text-[1.65rem] font-semibold leading-[1.35] text-sand sm:text-3xl md:text-[2.35rem]">
                মাঠের সিদ্ধান্তের জন্য নির্ভরযোগ্য কৃষি সহায়তা — বাংলায়।
              </h1>
              <p className="mt-5 max-w-xl text-base leading-relaxed text-sand/72 sm:text-lg">
                রোগ শনাক্তকরণ, সার ও স্প্রে নির্দেশনা, আবহাওয়া এবং বাজার তথ্য —
                অফলাইন সক্ষমতাসহ এক অ্যাপে।
              </p>
              <div className="mt-10 flex flex-wrap gap-3">
                <a
                  href="#features"
                  className="btn !bg-sand !text-forest-deep hover:!bg-white"
                >
                  সুবিধা দেখুন
                </a>
                <a
                  href="#how"
                  className="btn border border-white/30 !bg-transparent !text-sand hover:!bg-white/10"
                >
                  ব্যবহার পদ্ধতি
                </a>
              </div>
            </div>
          </div>
        </section>

        <section id="features" className="bg-sand">
          <div className="mx-auto max-w-6xl px-5 py-20 md:py-28">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold tracking-wide text-forest/70">
                মূল সক্ষমতা
              </p>
              <h2 className="mt-3 font-display text-3xl text-forest md:text-5xl">
                কৃষকের কাজের ধাপে ধাপে সহায়তা
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-muted">
                জটিল ইন্টারফেস নয় — প্রয়োজনীয় পরামর্শ, স্পষ্ট ভাষায়, মাঠেই ব্যবহারযোগ্য।
              </p>
            </div>

            <div className="mt-16 grid gap-12 md:grid-cols-3 md:gap-10">
              {FEATURES.map((f) => (
                <article key={f.title} className="border-t border-forest/30 pt-6">
                  <h3 className="text-xl font-semibold text-ink">{f.title}</h3>
                  <p className="mt-3 leading-relaxed text-muted">{f.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="border-y border-border bg-white">
          <div className="mx-auto max-w-6xl px-5 py-20 md:py-28">
            <div className="max-w-2xl">
              <p className="text-sm font-semibold tracking-wide text-forest/70">
                ব্যবহার পদ্ধতি
              </p>
              <h2 className="mt-3 font-display text-3xl text-forest md:text-5xl">
                তিনটি সহজ ধাপ
              </h2>
              <p className="mt-4 text-lg leading-relaxed text-muted">
                অ্যান্ড্রয়েড অ্যাপে স্ক্যান করে শুরু করুন — ছবি, কণ্ঠ বা লেখায়।
              </p>
            </div>

            <ol className="mt-16 grid gap-12 md:grid-cols-3 md:gap-10">
              {STEPS.map((s) => (
                <li key={s.n}>
                  <span className="font-display text-4xl text-leaf/90">{s.n}</span>
                  <h3 className="mt-4 text-xl font-semibold text-ink">{s.title}</h3>
                  <p className="mt-2 leading-relaxed text-muted">{s.body}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section className="relative overflow-hidden bg-forest-deep px-5 py-24 text-sand md:py-28">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage:
                "radial-gradient(circle at 20% 30%, rgba(63,154,116,.9), transparent 45%), radial-gradient(circle at 85% 70%, rgba(168,107,26,.35), transparent 40%)",
            }}
          />
          <div className="relative mx-auto max-w-6xl">
            <h2 className="font-display text-3xl leading-tight md:text-5xl">
              নেটওয়ার্ক দুর্বল হলেও কাজ চলে।
            </h2>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-sand/70">
              মূল মডেল ডিভাইসেই চলে। সংযোগ ফিরলে তথ্য সিঙ্ক হয় — একই কেন্দ্রীয়
              সিস্টেমের সঙ্গে।
            </p>
          </div>
        </section>

        <section id="team" className="bg-sand px-5 py-20 md:py-24">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-10 border-t border-border pt-16 md:flex-row md:items-end">
            <div className="max-w-xl">
              <p className="text-sm font-semibold tracking-wide text-forest/70">
                পরিচালনা
              </p>
              <h2 className="mt-3 font-display text-3xl text-forest md:text-4xl">
                দল ও অংশীদারদের জন্য প্রশাসনিক প্যানেল
              </h2>
              <p className="mt-4 leading-relaxed text-muted">
                ব্যবহারকারী ব্যবস্থাপনা, ঋণ আবেদন পর্যালোচনা এবং বিশ্লেষণাত্মক সারাংশ —
                মোবাইল অ্যাপের একই API‑র উপর ভিত্তি করে।
              </p>
            </div>
            <Link href="/admin/login" className="btn btn-primary shrink-0">
              প্রশাসক প্রবেশ
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

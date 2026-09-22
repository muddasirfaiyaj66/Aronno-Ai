import Image from "next/image";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/marketing/SiteChrome";

const FEATURES = [
  {
    title: "পাতা দেখে রোগ চিনুন",
    body: "ক্যামেরায় পাতার ছবি তুলুন — আরণ্য রোগের নাম ও পরবর্তী ধাপ বাংলায় বলে।",
  },
  {
    title: "কথা বলুন, অথবা লিখুন",
    body: "মাইকে বাংলায় সমস্যা বলুন। নেট না থাকলেও অফলাইন মডেল দিয়ে সাহায্য পাবেন।",
  },
  {
    title: "সার, আবহাওয়া, বাজার",
    body: "জমির হিসাব, বৃষ্টির সতর্কতা, স্থানীয় দাম — একই অ্যাপে।",
  },
];

const STEPS = [
  { n: "১", title: "অ্যাপ খুলুন", body: "স্ক্যান ট্যাবে যান।" },
  { n: "২", title: "ছবি বা কণ্ঠ", body: "পাতা তুলুন অথবা সমস্যা বলুন।" },
  { n: "৩", title: "বাংলায় উত্তর", body: "রোগ, ওষুধ ও সাবধানতা শুনুন।" },
];

export default function HomePage() {
  return (
    <div className="leaf-wash min-h-screen">
      <SiteHeader />

      <main>
        <section className="relative overflow-hidden">
          <div className="paddy-grid pointer-events-none absolute inset-0 opacity-70" />
          <div className="relative mx-auto grid max-w-6xl gap-12 px-5 pb-20 pt-14 lg:grid-cols-[1.2fr_0.8fr] lg:items-end lg:pb-28 lg:pt-24">
            <div className="rise-in">
              <p className="font-display text-6xl leading-none text-forest sm:text-7xl md:text-8xl">
                আরণ্য
              </p>
              <h1 className="mt-6 max-w-xl text-3xl font-semibold leading-snug text-ink sm:text-4xl">
                ক্ষেতের পাশেই এআই সহকারী — বাংলায়, সহজে।
              </h1>
              <p className="mt-4 max-w-lg text-lg text-muted">
                পাতার রোগ চিনুন, সার ও স্প্রের পরামর্শ নিন, আবহাওয়া দেখে সিদ্ধান্ত নিন।
                ইন্টারনেট দুর্বল হলেও অফলাইন মডেল কাজ করে।
              </p>
              <div className="mt-9 flex flex-wrap gap-3">
                <a href="#how" className="btn btn-primary">
                  কীভাবে কাজ করে
                </a>
                <Link href="/admin/login" className="btn btn-ghost">
                  অ্যাডমিন ড্যাশবোর্ড
                </Link>
              </div>
            </div>

            <div className="rise-in-delay relative mx-auto w-full max-w-md lg:mx-0">
              <div
                aria-hidden
                className="absolute -inset-8 rounded-[2.5rem] bg-forest/15 blur-3xl"
              />
              <div className="relative overflow-hidden rounded-[2rem] border border-border bg-white/95 p-6 shadow-[0_30px_80px_-40px_rgba(15,47,38,0.55)]">
                <div className="flex items-center gap-3 border-b border-border pb-4">
                  <Image
                    src="/icon.png"
                    alt=""
                    width={48}
                    height={48}
                    className="rounded-2xl"
                    priority
                  />
                  <div>
                    <p className="font-display text-xl text-forest">আরণ্য মোবাইল</p>
                    <p className="text-sm text-muted">অ্যান্ড্রয়েড · অফলাইন‑প্রথম</p>
                  </div>
                </div>
                <ul className="mt-5 space-y-4 text-base">
                  <li className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-leaf" />
                    <span>রোগ শনাক্ত — ছবি বা কণ্ঠ</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-leaf" />
                    <span>জেমা দিয়ে অফলাইন বাংলা চ্যাট</span>
                  </li>
                  <li className="flex gap-3">
                    <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-leaf" />
                    <span>বাজার দাম ও সরাসরি বিক্রি</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>
        </section>

        <section
          id="features"
          className="border-y border-border bg-white"
        >
          <div className="mx-auto max-w-6xl px-5 py-16 md:py-20">
            <h2 className="font-display text-3xl text-forest md:text-4xl">
              এক অ্যাপে ক্ষেতের কাজ
            </h2>
            <p className="mt-3 max-w-2xl text-muted">
              জটিল ড্যাশবোর্ড নয় — কৃষক যা করেন, সেই ধাপগুলোই সহজ করা।
            </p>
            <div className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
              {FEATURES.map((f) => (
                <article key={f.title} className="border-t-2 border-leaf pt-5">
                  <h3 className="text-xl font-semibold text-ink">{f.title}</h3>
                  <p className="mt-2 text-muted">{f.body}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how" className="mx-auto max-w-6xl px-5 py-16 md:py-20">
          <h2 className="font-display text-3xl text-forest md:text-4xl">
            তিন ধাপে শুরু
          </h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {STEPS.map((s) => (
              <li
                key={s.n}
                className="rounded-3xl border border-border bg-white/80 p-6"
              >
                <span className="font-display text-4xl text-leaf">{s.n}</span>
                <h3 className="mt-3 text-xl font-semibold">{s.title}</h3>
                <p className="mt-2 text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="field-band px-5 py-20 text-sand">
          <div className="mx-auto max-w-6xl">
            <p className="font-display text-4xl md:text-5xl">
              মাঠে দাঁড়িয়েই উত্তর।
            </p>
            <p className="mt-4 max-w-xl text-lg text-sand/80">
              নেট ধীর হলেও মডেল ফোনেই চলে। সংযোগ ফিরলে ডেটা সিঙ্ক হয় — একই ব্যাকএন্ডে।
            </p>
          </div>
        </section>

        <section className="bg-forest px-5 py-16 text-sand">
          <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-6 md:flex-row md:items-center">
            <div>
              <h2 className="font-display text-3xl md:text-4xl">
                দলের জন্য অ্যাডমিন প্যানেল
              </h2>
              <p className="mt-3 max-w-xl text-sand/80">
                ব্যবহারকারী দেখুন, নতুন অ্যাডমিন তৈরি করুন, অ্যাকাউন্ট সক্রিয় বা বন্ধ
                করুন — মোবাইল অ্যাপের একই API।
              </p>
            </div>
            <Link
              href="/admin/login"
              className="btn !bg-leaf !text-forest-deep hover:!bg-sand"
            >
              লগইন করুন
            </Link>
          </div>
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}

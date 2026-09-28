import Image from "next/image";
import Link from "next/link";
import { SiteFooter, SiteHeader } from "@/components/marketing/SiteChrome";

const CAPABILITIES = [
  {
    kicker: "স্ক্যান",
    title: "রোগ শনাক্তকরণ",
    body: "পাতার ছবি থেকে সম্ভাব্য রোগ ও পরের পদক্ষেপ — বাংলায়, স্পষ্ট ভাষায়।",
    image: "/marketing/leaf.jpg",
    alt: "কৃষক পাতা পরীক্ষা করছেন",
  },
  {
    kicker: "কণ্ঠ",
    title: "প্রশ্ন করুন",
    body: "বলুন বা লিখুন। নেট দুর্বল হলেও ফোনের মডেল সাহায্য করতে পারে।",
    image: "/marketing/field.jpg",
    alt: "ধানক্ষেতে কৃষক",
  },
  {
    kicker: "বাজার",
    title: "সার, আবহাওয়া, দাম",
    body: "সার নির্দেশনা, আবহাওয়ার সতর্কতা এবং স্থানীয় দাম একই অ্যাপে।",
    image: "/marketing/market.jpg",
    alt: "সকালের সবজির বাজার",
  },
];

const STEPS = [
  { n: "০১", title: "স্ক্যান খুলুন", body: "অ্যাপে স্ক্যান বিভাগে যান।" },
  { n: "০২", title: "ছবি বা প্রশ্ন দিন", body: "পাতা তুলুন, অথবা কণ্ঠে সমস্যা বলুন।" },
  { n: "০৩", title: "নির্দেশনা নিন", body: "রোগ, চিকিৎসা ও সতর্কতা বাংলায় পড়ুন।" },
];

const SPECS = [
  { title: "আর্দ্রতা", body: "মাটি কত ভেজা, ক্ষেতেই।" },
  { title: "পিএইচ", body: "মাটি অম্ল না ক্ষার।" },
  { title: "পুষ্টি", body: "সার দেওয়ার আগে ধারণা।" },
];

export default function HomePage() {
  return (
    <div className="min-h-screen bg-sand">
      <SiteHeader />
      <main>
        <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 py-12 md:px-6 md:py-20 lg:grid-cols-[1.05fr_0.95fr]">
          <div>
            <p className="section-label">আরণ্য · বাংলাদেশ</p>
            <h1 className="mt-4 max-w-xl font-display text-[clamp(2.7rem,6vw,4.6rem)] text-forest">
              মাঠের সিদ্ধান্ত, পরিষ্কার বাংলায়।
            </h1>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted">
              রোগ শনাক্তকরণ, সার ও স্প্রে, আবহাওয়া এবং বাজার — কৃষক যা করেন, সেই মুহূর্তের জন্য। নেট না থাকলেও মূল কাজ চলে।
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/heatmap" className="btn btn-primary">
                হিট ম্যাপ খুলুন
              </Link>
              <Link href="/market" className="btn btn-ghost">
                বাজার দেখুন
              </Link>
            </div>
            <dl className="mt-10 grid max-w-lg grid-cols-3 gap-4 border-t border-border pt-6">
              {[
                ["৬৪", "জেলা"],
                ["বাংলা", "ভাষা"],
                ["অফলাইন", "সক্ষম"],
              ].map(([value, label]) => (
                <div key={label}>
                  <dt className="font-display text-2xl text-forest">{value}</dt>
                  <dd className="text-sm text-muted">{label}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="relative">
            <div className="absolute -left-4 -top-4 hidden h-full w-full rounded-[2rem] bg-forest/10 md:block" aria-hidden />
            <div className="relative aspect-[4/5] overflow-hidden rounded-[2rem] shadow-[0_30px_60px_-36px_rgba(7,31,24,0.7)] sm:aspect-[5/4]">
              <Image
                src="/marketing/field.jpg"
                alt="ধানক্ষেতে কৃষক"
                fill
                priority
                sizes="(min-width: 1024px) 46vw, 100vw"
                className="object-cover object-[center_30%]"
              />
            </div>
          </div>
        </section>

        <section id="capabilities" className="border-y border-border bg-white">
          <div className="mx-auto max-w-6xl px-5 py-16 md:px-6 md:py-24">
            <div className="flex flex-wrap items-end justify-between gap-6">
              <div className="max-w-xl">
                <p className="section-label">সক্ষমতা</p>
                <h2 className="mt-3 font-display text-[clamp(1.8rem,4vw,2.8rem)] text-forest">
                  ক্ষেতের কাজের জন্য যা লাগে
                </h2>
              </div>
              <p className="max-w-sm text-muted">জটিল ড্যাশবোর্ড নয়। ছবি, কণ্ঠ, বাজার — যেটা এখন দরকার।</p>
            </div>
            <div className="mt-12 grid gap-6 md:grid-cols-3">
              {CAPABILITIES.map((item) => (
                <article key={item.title} className="group overflow-hidden rounded-[1.6rem] border border-border bg-sand/40">
                  <div className="relative h-52">
                    <Image
                      src={item.image}
                      alt={item.alt}
                      fill
                      sizes="(min-width: 768px) 30vw, 100vw"
                      className="object-cover transition duration-500 group-hover:scale-[1.03]"
                    />
                  </div>
                  <div className="p-6">
                    <p className="text-xs font-semibold tracking-[0.14em] text-leaf uppercase">{item.kicker}</p>
                    <h3 className="mt-2 text-xl font-semibold text-ink">{item.title}</h3>
                    <p className="mt-2 leading-relaxed text-muted">{item.body}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="device" className="bg-forest-deep text-sand">
          <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-16 md:px-6 md:py-24 lg:grid-cols-[0.92fr_1.08fr]">
            <div className="rounded-[2rem] bg-[#f3f6f1] p-3 shadow-[0_24px_50px_-30px_rgba(0,0,0,0.45)]">
              <div className="relative aspect-[4/3] overflow-hidden rounded-[1.35rem] bg-[#e7efe4]">
                <Image
                  src="/marketing/soil-meter.jpg"
                  alt="মাটির সেন্সরের পর্দায় আর্দ্রতা ৬২ শতাংশ, পিএইচ ৬.৪ এবং এনপিকে"
                  fill
                  sizes="(min-width: 1024px) 46vw, 100vw"
                  className="object-contain"
                />
              </div>
            </div>
            <div>
              <p className="text-xs font-semibold tracking-[0.16em] text-leaf uppercase">শীঘ্রই আসছে</p>
              <h2 className="mt-3 font-display text-[clamp(2rem,4vw,3.2rem)]">আরণ্য সয়েল সেন্সর</h2>
              <p className="mt-4 max-w-xl text-lg leading-relaxed text-sand/75">
                শুধু মাটি পরীক্ষার যন্ত্র। স্পাইক মাটিতে বসালে পর্দায় আর্দ্রতা, পিএইচ ও এনপিকে দেখায় — যেমন আর্দ্রতা ৬২%, পিএইচ ৬.৪। অ্যাপ সেই সংখ্যা পড়ে সারের পরামর্শ দেবে।
              </p>
              <ul className="mt-8 grid gap-3 sm:grid-cols-3">
                {SPECS.map((spec) => (
                  <li key={spec.title} className="rounded-2xl border border-white/12 bg-white/6 px-4 py-4">
                    <p className="font-semibold text-sand">{spec.title}</p>
                    <p className="mt-1 text-sm text-sand/65">{spec.body}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-sm text-sand/50">ব্র্যান্ডিং প্রিভিউ · এখনও বিক্রি হচ্ছে না</p>
            </div>
          </div>
        </section>

        <section id="how" className="mx-auto max-w-6xl px-5 py-16 md:px-6 md:py-24">
          <p className="section-label">ব্যবহার</p>
          <h2 className="mt-3 font-display text-[clamp(1.8rem,4vw,2.8rem)] text-forest">তিন ধাপে শুরু</h2>
          <ol className="mt-10 grid gap-4 md:grid-cols-3">
            {STEPS.map((step) => (
              <li key={step.n} className="rounded-[1.5rem] border border-border bg-white p-6">
                <span className="font-display text-4xl text-leaf">{step.n}</span>
                <h3 className="mt-4 text-xl font-semibold text-ink">{step.title}</h3>
                <p className="mt-2 text-muted">{step.body}</p>
              </li>
            ))}
          </ol>
        </section>

        <section className="mx-auto grid max-w-6xl gap-5 px-5 pb-20 md:grid-cols-2 md:px-6">
          <Link href="/heatmap" className="group relative min-h-64 overflow-hidden rounded-[1.7rem]">
            <Image src="/marketing/field.jpg" alt="" fill sizes="50vw" className="object-cover transition duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-forest-deep via-forest-deep/55 to-forest-deep/10" />
            <div className="relative flex h-full min-h-64 flex-col justify-end p-7 text-sand">
              <p className="text-sm font-semibold text-leaf">উন্মুক্ত মানচিত্র</p>
              <p className="mt-2 font-display text-4xl">রোগের হিট ম্যাপ</p>
            </div>
          </Link>
          <Link href="/market" className="group relative min-h-64 overflow-hidden rounded-[1.7rem]">
            <Image src="/marketing/market.jpg" alt="" fill sizes="50vw" className="object-cover transition duration-500 group-hover:scale-105" />
            <div className="absolute inset-0 bg-gradient-to-t from-forest-deep via-forest-deep/55 to-forest-deep/10" />
            <div className="relative flex h-full min-h-64 flex-col justify-end p-7 text-sand">
              <p className="text-sm font-semibold text-leaf">পাবলিক বাজার</p>
              <p className="mt-2 font-display text-4xl">দাম ও পণ্য</p>
            </div>
          </Link>
        </section>
      </main>
      <SiteFooter />
    </div>
  );
}

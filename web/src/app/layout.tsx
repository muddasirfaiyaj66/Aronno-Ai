import type { Metadata } from "next";
import { Hind_Siliguri, Tiro_Bangla } from "next/font/google";
import "./globals.css";

const hind = Hind_Siliguri({
  subsets: ["bengali", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hind",
  display: "swap",
});

const tiro = Tiro_Bangla({
  subsets: ["bengali", "latin"],
  weight: ["400"],
  variable: "--font-tiro",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "আরণ্য — ক্ষেতের সহজ সহচর",
    template: "%s · আরণ্য",
  },
  description:
    "পাতার ছবি তুলে রোগ চিনুন, বাংলায় পরামর্শ নিন, অফলাইনেও কাজ করুন। বাংলাদেশের কৃষকদের জন্য আরণ্য।",
  icons: {
    icon: "/favicon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="bn" className={`${hind.variable} ${tiro.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "কৃষি বাজার",
  description: "স্থানীয় বাজার দাম, পণ্য ও দোকান — আরণ্য পাবলিক বাজার তথ্য।",
};

export default function MarketLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

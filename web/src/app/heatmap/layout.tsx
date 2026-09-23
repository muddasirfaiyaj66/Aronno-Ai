import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "রোগের হিট ম্যাপ",
  description:
    "বাংলাদেশের জেলাভিত্তিক ফসলের রোগের প্রাদুর্ভাব — OpenStreetMap হিট ম্যাপ।",
};

export default function HeatmapLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}

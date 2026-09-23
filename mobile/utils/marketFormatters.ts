export const toBn = (num: number | string | undefined | null): string => {
  if (num === undefined || num === null || num === "") return "";
  const n = typeof num === "string" ? parseFloat(num) : num;
  if (isNaN(n)) return String(num);
  return new Intl.NumberFormat("bn-BD").format(n);
};

export const UNIT_BN: Record<string, string> = {
  kg: "কেজি",
  mon: "মণ",
  ton: "টন",
  piece: "টি",
  liter: "লিটার",
  bag: "বস্তা",
};

export const formatUnitBn = (unit?: string): string => {
  if (!unit) return "";
  return UNIT_BN[unit] ?? unit;
};

export const formatPriceBn = (price?: number | null, unit?: string): string => {
  if (price === undefined || price === null) return "";
  const formattedPrice = `৳ ${toBn(price)}`;
  if (unit) {
    return `${formattedPrice} / ${formatUnitBn(unit)}`;
  }
  return formattedPrice;
};

export const CATEGORY_BN: Record<string, string> = {
  crops: "শস্য",
  vegetables: "সবজি",
  fruits: "ফল",
  seeds: "বীজ",
  fertilizers: "সার",
  pesticides: "কীটনাশক",
  fish: "মাছ",
  dairy: "দুধ ও দুগ্ধজাত পণ্য",
  eggs: "ডিম",
  tools: "যন্ত্রপাতি",
  other: "অন্যান্য",
};

export const formatCategoryBn = (category?: string): string => {
  if (!category) return "";
  return CATEGORY_BN[category] ?? category;
};

export const GRADE_BN: Record<string, string> = {
  premium: "প্রিমিয়াম",
  grade_a: "গ্রেড-এ",
  grade_b: "গ্রেড-বি",
  standard: "মানসম্মত (স্ট্যান্ডার্ড)",
};

export const formatGradeBn = (grade?: string): string => {
  if (!grade) return "";
  return GRADE_BN[grade] ?? grade;
};

export const formatDateBn = (dateInput?: string | Date | null): string => {
  if (!dateInput) return "";
  try {
    const d = typeof dateInput === "string" ? new Date(dateInput) : dateInput;
    if (isNaN(d.getTime())) return "";
    return d.toLocaleDateString("bn-BD", {
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  } catch {
    return String(dateInput);
  }
};

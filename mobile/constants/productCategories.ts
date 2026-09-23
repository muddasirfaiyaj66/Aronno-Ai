import { Ionicons } from "@expo/vector-icons";

export type ProductCategoryKey =
  | "crops"
  | "vegetables"
  | "fruits"
  | "seeds"
  | "fertilizers"
  | "pesticides"
  | "fish"
  | "dairy"
  | "eggs"
  | "tools"
  | "other";

export type ProductCategoryOption = {
  id: ProductCategoryKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

export const PRODUCT_CATEGORIES: ProductCategoryOption[] = [
  { id: "crops", label: "শস্য", icon: "leaf-outline" },
  { id: "vegetables", label: "সবজি", icon: "basket-outline" },
  { id: "fruits", label: "ফল", icon: "nutrition-outline" },
  { id: "seeds", label: "বীজ", icon: "flower-outline" },
  { id: "fertilizers", label: "সার", icon: "flask-outline" },
  { id: "pesticides", label: "কীটনাশক", icon: "shield-outline" },
  { id: "fish", label: "মাছ", icon: "fish-outline" },
  { id: "dairy", label: "দুধ ও দুগ্ধজাত পণ্য", icon: "water-outline" },
  { id: "eggs", label: "ডিম", icon: "egg-outline" },
  { id: "tools", label: "যন্ত্রপাতি", icon: "construct-outline" },
  { id: "other", label: "অন্যান্য কৃষিপণ্য", icon: "cube-outline" },
];

export function getCategoryLabel(catId: string): string {
  const found = PRODUCT_CATEGORIES.find((c) => c.id === catId);
  return found ? found.label : "অন্যান্য কৃষিপণ্য";
}

import type { Ionicons } from "@expo/vector-icons";
import type { CropType } from "@/types/treatment";

export type CropOption = {
  id: CropType;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
};

/** Crops the cost table and fertilizer rules both understand. */
export const CROP_OPTIONS: CropOption[] = [
  { id: "rice", label: "ধান", icon: "leaf-outline" },
  { id: "potato", label: "আলু", icon: "ellipse-outline" },
  { id: "tomato", label: "টমেটো", icon: "nutrition-outline" },
  { id: "vegetable", label: "সবজি", icon: "basket-outline" },
  { id: "onion", label: "পেঁয়াজ", icon: "flower-outline" },
  { id: "mustard", label: "সরিষা", icon: "color-fill-outline" },
  { id: "lentil", label: "মসুর ডাল", icon: "restaurant-outline" },
  { id: "corn", label: "ভুট্টা", icon: "sunny-outline" },
];

export function cropLabel(id: CropType | null | undefined) {
  return CROP_OPTIONS.find((c) => c.id === id)?.label ?? "";
}

import type { ComponentProps } from "react";
import { Ionicons } from "@expo/vector-icons";

type IconName = ComponentProps<typeof Ionicons>["name"];

export type MonthForecast = {
  month: string;
  weatherIcon: IconName;
  recommendedCropBn: string;
};

export type CropPlan = {
  months: MonthForecast[];
  /** 3-4 sentence AI-generated cultivation recommendation. */
  recommendationBn: string;
};

// TODO(nestjs): replace with a real Gemini/Gamma 6-month weather-to-cultivation
// call once the backend is wired.
export const MOCK_CROP_PLAN: CropPlan = {
  months: [
    { month: "শ্রাবণ", weatherIcon: "rainy-outline", recommendedCropBn: "আমন ধান" },
    { month: "ভাদ্র", weatherIcon: "rainy-outline", recommendedCropBn: "আমন ধান" },
    { month: "আশ্বিন", weatherIcon: "partly-sunny-outline", recommendedCropBn: "শাকসবজি" },
    { month: "কার্তিক", weatherIcon: "sunny-outline", recommendedCropBn: "আলু" },
    { month: "অগ্রহায়ণ", weatherIcon: "sunny-outline", recommendedCropBn: "আলু" },
    { month: "পৌষ", weatherIcon: "cloudy-outline", recommendedCropBn: "সরিষা" },
  ],
  recommendationBn:
    "আগামী ছয় মাসের আবহাওয়া পূর্বাভাস অনুযায়ী শ্রাবণ ও ভাদ্র মাসে পর্যাপ্ত বৃষ্টিপাত হবে, যা আমন ধান চাষের জন্য উপযুক্ত সময়। আশ্বিনের পর বৃষ্টি কমে আসবে বলে এই সময় শাকসবজি চাষ শুরু করা যেতে পারে। শীত মৌসুমে (কার্তিক–অগ্রহায়ণ) শুষ্ক ও ঠান্ডা আবহাওয়া আলু চাষের জন্য আদর্শ, তাই এই সময় আলু রোপণের পরিকল্পনা করুন। সবশেষে পৌষ মাসে সরিষা চাষ করে জমির সর্বোচ্চ ব্যবহার নিশ্চিত করা সম্ভব।",
};

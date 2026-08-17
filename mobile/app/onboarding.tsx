import type { ComponentProps } from "react";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppText, PrimaryButton } from "@/components/ui";
import { colors } from "@/constants/theme";
import { ONBOARDING_STORAGE_KEY } from "@/utils/onboarding";

type IconName = ComponentProps<typeof Ionicons>["name"];

const STEPS: { icon: IconName; title: string; description: string }[] = [
  {
    icon: "camera-outline",
    title: "ছবি তুলুন বা কথা বলুন",
    description: "ফসলের সমস্যা দেখান বা বাংলায় বলুন, বাকিটা আমরা করব।",
  },
  {
    icon: "medkit-outline",
    title: "সুসংগঠিত পরিকল্পনা পান",
    description: "ধাপে ধাপে চিকিৎসা ও খরচের পরামর্শ সহজ ভাষায় পান।",
  },
  {
    icon: "trending-up-outline",
    title: "ইতিহাস রাখুন, বুদ্ধিমানের মতো বিক্রি করুন",
    description: "সব রেকর্ড এক জায়গায়, আর বাজারের সেরা দামে বিক্রি করুন।",
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  const finishOnboarding = async () => {
    // TODO(nestjs): once accounts exist, also sync this flag to the user's
    // profile so onboarding stays skipped across reinstalls/devices.
    await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    router.replace("/(root)/(tabs)");
  };

  const handleNext = () => {
    if (isLast) {
      finishOnboarding();
      return;
    }
    setStep((s) => s + 1);
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top", "bottom"]}>
      <View className="flex-row justify-end px-3 pt-2">
        <Pressable
          onPress={finishOnboarding}
          accessibilityRole="button"
          accessibilityLabel="পরিচিতি এড়িয়ে যান"
          className="min-h-touch items-center justify-center px-4"
        >
          <AppText variant="body" className="font-bengali-bold text-muted">
            এড়িয়ে যান
          </AppText>
        </Pressable>
      </View>

      <View className="flex-1 items-center justify-center gap-6 px-8">
        <View className="h-28 w-28 items-center justify-center rounded-full bg-secondary">
          <Ionicons name={current.icon} size={56} color={colors.primary} />
        </View>
        <AppText variant="title" className="text-center">
          {current.title}
        </AppText>
        <AppText variant="bodyLg" className="text-center text-muted">
          {current.description}
        </AppText>
      </View>

      <View className="items-center gap-6 px-8 pb-4">
        <View
          className="flex-row items-center gap-2"
          accessibilityRole="text"
          accessibilityLabel={`ধাপ ${step + 1} এর ৩`}
        >
          {STEPS.map((_, index) => (
            <View
              key={index}
              className={`h-2 rounded-full ${
                index === step ? "w-6 bg-primary" : "w-2 bg-neutral-200"
              }`}
            />
          ))}
        </View>

        <PrimaryButton
          label={isLast ? "শুরু করুন" : "পরবর্তী"}
          onPress={handleNext}
          className="w-full"
          icon={
            <Ionicons
              name={isLast ? "checkmark" : "arrow-forward"}
              size={20}
              color={colors.white}
            />
          }
        />
      </View>
    </SafeAreaView>
  );
}

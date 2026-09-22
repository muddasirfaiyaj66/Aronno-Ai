import type { ComponentProps } from "react";
import { useState } from "react";
import { Image, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { AppText, PrimaryButton } from "@/components/ui";
import { colors } from "@/constants/theme";
import { ONBOARDING_STORAGE_KEY } from "@/utils/onboarding";

type IconName = ComponentProps<typeof Ionicons>["name"];

const STEPS: { icon: IconName; title: string; description: string }[] = [
  {
    icon: "camera",
    title: "পাতার ছবি তুলুন",
    description: "রোগ শনাক্ত করুন মুহূর্তে। ফোনের ক্যামেরাই যথেষ্ট।",
  },
  {
    icon: "mic",
    title: "বাংলায় বলুন, অথবা লিখুন",
    description: "কথা বলতে না পারলে লিখেও জানাতে পারবেন। দুটোই সহজ।",
  },
  {
    icon: "rainy-outline",
    title: "আবহাওয়া মেনে স্প্রে",
    description: "বৃষ্টি হলে সতর্কতা পাবেন — ওষুধ নষ্ট হবে না।",
  },
  {
    icon: "volume-high",
    title: "ফলাফল বাংলায় শুনুন",
    description: "পড়া কষ্ট হলে «শুনুন বাংলায়» চাপুন। যন্ত্র ও রসিদও এভাবে।",
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const isLast = step === STEPS.length - 1;
  const current = STEPS[step];

  const finishOnboarding = async () => {
    await AsyncStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
    router.replace("/login");
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
      <LinearGradient
        colors={[colors.forest900, colors.primary]}
        className="px-5 pb-8 pt-3"
        style={{ paddingHorizontal: 20, paddingTop: 12, paddingBottom: 36 }}
      >
        <View className="flex-row items-center justify-between">
          <View className="flex-row items-center gap-2.5">
            <Image
              source={require("@/assets/images/icon.png")}
              accessibilityLabel="আরণ্য"
              style={{ height: 36, width: 36, borderRadius: 10 }}
            />
            <AppText variant="caption" className="font-bengali-bold text-leaf-300">
              আরণ্য
            </AppText>
          </View>
          <Pressable
            onPress={finishOnboarding}
            accessibilityRole="button"
            accessibilityLabel="পরিচিতি এড়িয়ে যান"
            className="min-h-touch items-center justify-center px-2"
          >
            <AppText variant="body" className="font-bengali-bold text-white">
              এড়িয়ে যান
            </AppText>
          </Pressable>
        </View>
        <AppText variant="display" className="mt-6 text-white">
          ক্ষেতের সহজ সহচর
        </AppText>
        <AppText variant="bodyLg" className="mt-2 text-secondary">
          ফসলের রোগ চিনুন, ওষুধ জানুন, আবহাওয়া দেখে স্প্রে করুন।
        </AppText>
      </LinearGradient>

      <View className="-mt-5 flex-1 rounded-t-[32px] bg-neutral px-8 pt-10">
        <View className="flex-1 items-center justify-center gap-5">
          <View className="h-28 w-28 items-center justify-center rounded-full bg-secondary">
            <Ionicons name={current.icon} size={52} color={colors.primary} />
          </View>
          <AppText variant="title" className="text-center">
            {current.title}
          </AppText>
          <AppText variant="bodyLg" className="text-center leading-8 text-muted">
            {current.description}
          </AppText>
        </View>

        <View className="items-center gap-6 pb-4">
          <View className="flex-row items-center gap-2">
            {STEPS.map((_, index) => (
              <View
                key={index}
                className={`h-2.5 rounded-full ${
                  index === step ? "w-8 bg-primary" : "w-2.5 bg-neutral-200"
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
      </View>
    </SafeAreaView>
  );
}

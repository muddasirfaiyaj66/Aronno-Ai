import { View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "@/components/ui/AppText";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { StructuredCard } from "@/components/ui/StructuredCard";
import { colors } from "@/constants/theme";

type ShopPromptCardProps = {
  onCreateShop: () => void;
};

export function ShopPromptCard({ onCreateShop }: ShopPromptCardProps) {
  return (
    <StructuredCard
      title="আপনার দোকান খুলুন"
      tone="soft"
      icon={<Ionicons name="storefront" size={22} color={colors.primary} />}
    >
      <View className="gap-3 py-1">
        <AppText variant="body" className="font-bengali-medium text-ink">
          আপনি কি পণ্য বিক্রি করতে চান? আপনার নিজস্ব কৃষি দোকান তৈরি করে সরাসরি ক্রেতাদের কাছে ধান, সবজি, সার বা বীজ বিক্রি শুরু করুন।
        </AppText>
        <PrimaryButton
          label="দোকান তৈরি করুন"
          onPress={onCreateShop}
          icon={<Ionicons name="add-circle-outline" size={20} color={colors.white} />}
        />
      </View>
    </StructuredCard>
  );
}

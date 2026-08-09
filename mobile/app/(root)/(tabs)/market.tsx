import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { AppText, StructuredCard } from "@/components/ui";
import { colors } from "@/constants/theme";

const MOCK_PRICES = [
  { crop: "ধান (আমন)", price: "৳ ৪৮", unit: "/ কেজি", place: "যশোর" },
  { crop: "আলু", price: "৳ ৩২", unit: "/ কেজি", place: "মুন্সিগঞ্জ" },
  { crop: "টমেটো", price: "৳ ৫৫", unit: "/ কেজি", place: "বগুড়া" },
];

export default function MarketScreen() {
  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <View className="border-b border-neutral-200 bg-white px-5 py-4">
        <AppText variant="title">বাজার</AppText>
        <AppText variant="caption" className="mt-1">
          আজকের স্থানীয় ফসলের দর
        </AppText>
      </View>
      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-4 px-5 py-5"
      >
        {MOCK_PRICES.map((item) => (
          <StructuredCard
            key={item.crop}
            title={item.crop}
            icon={
              <Ionicons name="pricetag" size={20} color={colors.primary} />
            }
            footer={
              <AppText variant="caption">বাজার · {item.place}</AppText>
            }
          >
            <View className="flex-row items-end gap-2">
              <AppText variant="hero">{item.price}</AppText>
              <AppText variant="body" className="mb-2 text-muted">
                {item.unit}
              </AppText>
            </View>
          </StructuredCard>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

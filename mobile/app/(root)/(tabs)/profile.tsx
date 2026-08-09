import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { AppText, SecondaryButton, StructuredCard } from "@/components/ui";
import { colors } from "@/constants/theme";

export default function ProfileScreen() {
  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <View className="border-b border-neutral-200 bg-white px-5 py-4">
        <AppText variant="title">প্রোফাইল</AppText>
        <AppText variant="caption" className="mt-1">
          আপনার খামার ও অ্যাকাউন্ট
        </AppText>
      </View>

      <View className="gap-4 px-5 py-5">
        <StructuredCard
          title="কৃষক পরিচয়"
          icon={<Ionicons name="person" size={22} color={colors.primary} />}
        >
          <AppText variant="bodyLg">করিম মিয়া</AppText>
          <AppText variant="body" className="mt-1 text-muted">
            যশোর · ধান ও সবজি
          </AppText>
        </StructuredCard>

        <SecondaryButton
          label="সেটিংস"
          onPress={() => {}}
          icon={
            <Ionicons
              name="settings-outline"
              size={20}
              color={colors.ink}
            />
          }
        />
      </View>
    </SafeAreaView>
  );
}

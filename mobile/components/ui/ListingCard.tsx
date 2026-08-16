import { Image, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "./AppText";
import { colors } from "@/constants/theme";

export type ListingCardProps = {
  sourceName: string;
  thumbnailUrl?: string;
  price?: string;
  onPressLink: () => void;
  className?: string;
};

export function ListingCard({
  sourceName,
  thumbnailUrl,
  price,
  onPressLink,
  className = "",
}: ListingCardProps) {
  return (
    <View
      className={`w-40 overflow-hidden rounded-3xl bg-white ${className}`}
      style={styles.card}
    >
      {thumbnailUrl ? (
        <Image
          source={{ uri: thumbnailUrl }}
          style={styles.thumbnail}
          resizeMode="cover"
        />
      ) : (
        <View style={styles.thumbnail} className="items-center justify-center bg-secondary">
          <Ionicons name="cube-outline" size={28} color={colors.primary} />
        </View>
      )}

      <View className="gap-2 p-3">
        <AppText
          variant="caption"
          numberOfLines={1}
          className="font-bengali-semibold text-ink"
        >
          {sourceName}
        </AppText>

        <AppText variant="bodyLg" className="font-bengali-bold text-primary">
          {price ?? "—"}
        </AppText>

        <Pressable
          onPress={onPressLink}
          accessibilityRole="button"
          accessibilityLabel={`${sourceName} এ দেখুন`}
          className="min-h-touch flex-row items-center justify-center gap-1.5 rounded-2xl bg-secondary px-3"
        >
          <Ionicons name="open-outline" size={16} color={colors.primary} />
          <AppText variant="caption" className="font-bengali-bold text-primary">
            দেখুন
          </AppText>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    shadowColor: "#064E3B",
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 3,
  },
  thumbnail: {
    height: 100,
    width: "100%",
  },
});

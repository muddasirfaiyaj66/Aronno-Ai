import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, { FadeInDown } from "react-native-reanimated";
import { AppText } from "@/components/ui/AppText";
import { useLocale } from "@/context/locale";
import { formatHomeDate, formatHomeTime } from "@/utils/datetime";

export function DateWeatherCard() {
  const { t, locale } = useLocale();
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <Animated.View entering={FadeInDown.delay(60).duration(480).springify()}>
      <View style={styles.shadow}>
        <LinearGradient
          colors={["#ECFDF5", "#FFFFFF", "#D1FAE5"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.card}
        >
          <View className="flex-row items-start justify-between">
            <View className="flex-1 pr-3">
              <AppText variant="caption" className="font-bengali-semibold text-primary">
                {t("আজকের দিন", "Today")}
              </AppText>
              <AppText variant="title" className="mt-1 text-primary">
                {formatHomeDate(now, locale)}
              </AppText>
              <View className="mt-3 flex-row items-center gap-2">
                <View
                  className="h-8 w-8 items-center justify-center rounded-full"
                  style={{ backgroundColor: "rgba(6,78,59,0.1)" }}
                >
                  <Ionicons name="time-outline" size={16} color="#064E3B" />
                </View>
                <AppText variant="bodyLg" className="font-bengali-bold text-ink">
                  {formatHomeTime(now, locale)}
                </AppText>
              </View>
            </View>
          </View>
        </LinearGradient>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  shadow: {
    borderRadius: 28,
    shadowColor: "#064E3B",
    shadowOpacity: 0.08,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  card: {
    borderRadius: 28,
    paddingHorizontal: 18,
    paddingVertical: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(209,250,229,0.9)",
  },
});

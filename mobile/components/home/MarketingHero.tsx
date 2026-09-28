import { useEffect } from "react";
import { Image, Pressable, View } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import Animated, {
  Easing,
  FadeInDown,
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";
import { AppText } from "@/components/ui/AppText";
import { LanguageToggle } from "@/components/ui/LanguageToggle";
import { colors } from "@/constants/theme";

const field = require("../../assets/images/marketing/farmer-field.jpg");
const leaf = require("../../assets/images/marketing/farmer-leaf.jpg");
const market = require("../../assets/images/marketing/farmer-market.jpg");

export type MarketingHeroProps = {
  greeting: string;
  onNotify: () => void;
  onScan: () => void;
  onMarket: () => void;
  notifyLabel: string;
  unread?: number;
  scanTitle: string;
  scanBody: string;
  marketTitle: string;
  marketBody: string;
};

export function MarketingHero({
  greeting,
  onNotify,
  onScan,
  onMarket,
  notifyLabel,
  unread = 0,
  scanTitle,
  scanBody,
  marketTitle,
  marketBody,
}: MarketingHeroProps) {
  const drift = useSharedValue(1);

  useEffect(() => {
    drift.value = withRepeat(
      withTiming(1.08, { duration: 9000, easing: Easing.inOut(Easing.quad) }),
      -1,
      true,
    );
  }, [drift]);

  const photoStyle = useAnimatedStyle(() => ({
    transform: [{ scale: drift.value }],
  }));

  return (
    <View className="gap-4">
      <Animated.View
        entering={FadeInDown.duration(500)}
        className="overflow-hidden rounded-[28px]"
        style={{ height: 280 }}
      >
        <Animated.Image
          source={field}
          resizeMode="cover"
          style={[{ position: "absolute", top: -12, left: -12, right: -12, bottom: -12 }, photoStyle]}
        />
        <LinearGradient
          colors={["rgba(6,24,22,0.15)", "rgba(6,24,22,0.2)", "rgba(6,24,22,0.88)"]}
          style={{ flex: 1, justifyContent: "space-between", padding: 16 }}
        >
          <View className="flex-row items-center justify-end gap-2">
            <LanguageToggle light />
            <Pressable
              onPress={onNotify}
              accessibilityRole="button"
              accessibilityLabel={notifyLabel}
              className="h-11 w-11 items-center justify-center rounded-full"
              style={{ backgroundColor: "rgba(255,255,255,0.18)" }}
            >
              <Ionicons name="notifications-outline" size={20} color={colors.white} />
              {unread > 0 ? (
                <View
                  className="absolute -right-1 -top-1 min-w-[18px] items-center justify-center rounded-full bg-severity-high px-1"
                  style={{ height: 18 }}
                >
                  <AppText variant="caption" style={{ color: colors.white, fontSize: 10, lineHeight: 14 }}>
                    {unread > 9 ? "9+" : String(unread)}
                  </AppText>
                </View>
              ) : null}
            </Pressable>
          </View>
          <View>
            <View className="self-start rounded-full bg-white/20 px-3 py-1">
              <AppText variant="caption" className="font-bengali-semibold" style={{ color: colors.white }}>
                কৃষকের জন্য আরণ্য
              </AppText>
            </View>
            <AppText variant="title" className="mt-2" style={{ color: colors.white }}>
              {greeting}
            </AppText>
            <AppText variant="caption" className="mt-1 leading-5" style={{ color: "rgba(255,255,255,0.9)" }}>
              পাতার ছবি তুলুন, রোগ চিনুন, সার ও বাজার — এক জায়গায়।
            </AppText>
          </View>
        </LinearGradient>
      </Animated.View>

      <View className="flex-row gap-3">
        <CampaignCard
          image={leaf}
          title={scanTitle}
          body={scanBody}
          onPress={onScan}
          delay={80}
        />
        <CampaignCard
          image={market}
          title={marketTitle}
          body={marketBody}
          onPress={onMarket}
          delay={160}
        />
      </View>
    </View>
  );
}

function CampaignCard({
  image,
  title,
  body,
  onPress,
  delay,
}: {
  image: number;
  title: string;
  body: string;
  onPress: () => void;
  delay: number;
}) {
  return (
    <Animated.View entering={FadeInRight.delay(delay).duration(480)} className="flex-1">
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${body}`}
        className="overflow-hidden rounded-3xl border border-border bg-card"
      >
        <Image source={image} resizeMode="cover" style={{ height: 108, width: "100%" }} />
        <View className="gap-0.5 px-3 py-3">
          <AppText variant="body" numberOfLines={1} className="font-bengali-bold text-ink">
            {title}
          </AppText>
          <AppText variant="caption" numberOfLines={2} className="leading-5">
            {body}
          </AppText>
        </View>
      </Pressable>
    </Animated.View>
  );
}

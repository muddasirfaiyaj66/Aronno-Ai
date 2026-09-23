import { Image, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "@/components/ui/AppText";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SecondaryButton } from "@/components/ui/SecondaryButton";
import { StructuredCard } from "@/components/ui/StructuredCard";
import { colors } from "@/constants/theme";
import type { ShopData } from "@/types/market";

type ShopDashboardViewProps = {
  shop: ShopData;
  onEditShop: () => void;
  onAddProduct: () => void;
  onViewMyProducts: () => void;
};

export function ShopDashboardView({
  shop,
  onEditShop,
  onAddProduct,
  onViewMyProducts,
}: ShopDashboardViewProps) {
  const districtName = shop.district?.nameBn ?? "";
  const locationText = [districtName, shop.upazila, shop.address]
    .filter(Boolean)
    .join(" · ");

  return (
    <View className="gap-4">
      <StructuredCard
        title={shop.name}
        icon={<Ionicons name="storefront" size={22} color={colors.primary} />}
        footer={
          <SecondaryButton
            label="দোকান সম্পাদনা করুন"
            onPress={onEditShop}
            icon={<Ionicons name="create-outline" size={18} color={colors.ink} />}
          />
        }
      >
        <View className="gap-3">
          <View className="flex-row items-center gap-3">
            {shop.logoUrl ? (
              <Image
                source={{ uri: shop.logoUrl }}
                className="h-16 w-16 rounded-2xl bg-neutral"
                resizeMode="cover"
              />
            ) : (
              <View className="h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <Ionicons name="storefront" size={28} color={colors.primary} />
              </View>
            )}
            <View className="flex-1">
              <AppText variant="subtitle" className="font-bengali-bold text-ink">
                {shop.name}
              </AppText>
              {locationText ? (
                <AppText variant="caption" className="text-muted mt-0.5">
                  📍 {locationText}
                </AppText>
              ) : null}
              <AppText variant="caption" className="text-muted mt-0.5">
                📞 {shop.phone}
              </AppText>
            </View>
          </View>

          {shop.description ? (
            <AppText variant="body" className="font-bengali-medium text-ink">
              {shop.description}
            </AppText>
          ) : null}

          {/* Stats Summary */}
          <View className="flex-row items-center justify-around rounded-2xl bg-neutral py-3">
            <View className="items-center">
              <AppText variant="title" className="font-bengali-bold text-primary">
                {new Intl.NumberFormat("bn-BD").format(shop._count?.products ?? 0)}
              </AppText>
              <AppText variant="caption" className="text-muted">
                মোট পণ্য
              </AppText>
            </View>
            <View className="h-8 w-px bg-border" />
            <View className="items-center">
              <AppText variant="title" className="font-bengali-bold text-primary">
                {new Intl.NumberFormat("bn-BD").format(shop._count?.orders ?? 0)}
              </AppText>
              <AppText variant="caption" className="text-muted">
                মোট অর্ডার
              </AppText>
            </View>
          </View>
        </View>
      </StructuredCard>

      {/* Action Buttons */}
      <View className="flex-row gap-3">
        <View className="flex-1">
          <PrimaryButton
            label="পণ্য যোগ করুন"
            onPress={onAddProduct}
            icon={<Ionicons name="add-circle" size={18} color={colors.white} />}
          />
        </View>
        <View className="flex-1">
          <SecondaryButton
            label="আমার পণ্য"
            onPress={onViewMyProducts}
            icon={<Ionicons name="cube-outline" size={18} color={colors.ink} />}
          />
        </View>
      </View>
    </View>
  );
}

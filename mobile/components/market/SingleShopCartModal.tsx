import { Modal, Pressable, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "@/components/ui/AppText";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { SecondaryButton } from "@/components/ui/SecondaryButton";
import { colors } from "@/constants/theme";

type SingleShopCartModalProps = {
  visible: boolean;
  onClose: () => void;
  onConfirmClearAndAdd: () => void;
  loading?: boolean;
};

export function SingleShopCartModal({
  visible,
  onClose,
  onConfirmClearAndAdd,
  loading = false,
}: SingleShopCartModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onClose}
    >
      <View className="flex-1 bg-black/60 items-center justify-center px-5">
        <View className="w-full max-w-sm rounded-3xl bg-white p-5 gap-4 shadow-xl border border-border">
          {/* Header Icon & Title */}
          <View className="items-center gap-2">
            <View className="h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 border border-amber-200">
              <Ionicons name="warning-outline" size={32} color="#D97706" />
            </View>
            <AppText variant="subtitle" className="font-bengali-bold text-ink text-center">
              কার্ট সতর্কতা
            </AppText>
          </View>

          {/* Description */}
          <AppText variant="body" className="font-bengali-medium text-ink text-center leading-relaxed">
            আপনার কার্টে অন্য একটি দোকানের পণ্য আছে। নতুন দোকানের পণ্য যোগ করলে বর্তমান কার্টটি খালি হবে।
          </AppText>

          {/* Action Buttons */}
          <View className="gap-2.5 pt-1">
            <PrimaryButton
              label="কার্ট খালি করুন"
              onPress={onConfirmClearAndAdd}
              loading={loading}
              icon={<Ionicons name="trash-outline" size={18} color={colors.white} />}
            />
            <SecondaryButton
              label="বাতিল"
              onPress={onClose}
              disabled={loading}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

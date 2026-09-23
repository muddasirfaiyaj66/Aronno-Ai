import { useState } from "react";
import { Modal, Pressable, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "@/components/ui/AppText";
import { PrimaryButton } from "@/components/ui/PrimaryButton";
import { colors } from "@/constants/theme";
import { useCreateReviewMutation } from "@/services/api";

type ReviewModalProps = {
  visible: boolean;
  onClose: () => void;
  orderId: string;
  productId: string;
  productName: string;
};

export function ReviewModal({
  visible,
  onClose,
  orderId,
  productId,
  productName,
}: ReviewModalProps) {
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [createReview, { isLoading }] = useCreateReviewMutation();

  const handleSubmit = async () => {
    setErrorMsg(null);
    try {
      await createReview({
        orderId,
        productId,
        rating,
        comment: comment.trim(),
      }).unwrap();
      onClose();
    } catch (err: unknown) {
      const msg =
        err && typeof err === "object" && "message" in err
          ? (err as { message: string }).message
          : "রিভিউ জমা দিতে ব্যর্থ হয়েছে। আবার চেষ্টা করুন।";
      setErrorMsg(msg);
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={onClose}>
      <View className="flex-1 bg-black/50 items-center justify-center px-5">
        <View className="w-full rounded-3xl bg-white p-6 gap-4">
          <View className="flex-row items-center justify-between border-b border-border pb-3">
            <AppText variant="subtitle" className="font-bengali-bold text-ink">
              পণ্যের রিভিউ দিন
            </AppText>
            <Pressable onPress={onClose} className="h-8 w-8 items-center justify-center rounded-full bg-neutral">
              <Ionicons name="close" size={18} color={colors.ink} />
            </Pressable>
          </View>

          <AppText variant="body" className="font-bengali-semibold text-ink">
            {productName}
          </AppText>

          {/* Star Rating Picker */}
          <View className="flex-row items-center justify-center gap-3 py-2">
            {[1, 2, 3, 4, 5].map((star) => (
              <Pressable key={star} onPress={() => setRating(star)}>
                <Ionicons
                  name={star <= rating ? "star" : "star-outline"}
                  size={32}
                  color={star <= rating ? "#F59E0B" : colors.border}
                />
              </Pressable>
            ))}
          </View>

          <TextInput
            value={comment}
            onChangeText={setComment}
            multiline
            numberOfLines={3}
            placeholder="পণ্যের মান ও অভিজ্ঞতার কথা লিখুন (ঐচ্ছিক)..."
            placeholderTextColor={colors.muted}
            className="min-h-[80px] rounded-2xl bg-neutral p-4 font-bengali-medium text-body text-ink"
          />

          {errorMsg ? (
            <AppText variant="caption" className="font-bengali-medium text-red-600">
              {errorMsg}
            </AppText>
          ) : null}

          <PrimaryButton
            label="রিভিউ জমা দিন"
            onPress={handleSubmit}
            loading={isLoading}
            icon={<Ionicons name="checkmark-circle" size={18} color={colors.white} />}
          />
        </View>
      </View>
    </Modal>
  );
}

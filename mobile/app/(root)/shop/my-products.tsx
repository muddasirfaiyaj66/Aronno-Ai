import { useState } from "react";
import { Alert, Image, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
  AIGeneratingShimmer,
  AppText,
  EmptyState,
  RetryCard,
} from "@/components/ui";
import { AddProductModal } from "@/components/market/AddProductModal";
import { colors } from "@/constants/theme";
import {
  useDeleteProductMutation,
  useGetMyProductsQuery,
  useUpdateProductMutation,
} from "@/services/api";

const CATEGORY_LABELS: Record<string, string> = {
  crops: "ফসল/ধান",
  vegetables: "সবজি",
  fruits: "ফলমূল",
  seeds: "বীজ",
  fertilizers: "সার",
  pesticides: "কীটনাশক",
  tools: "যন্ত্রপাতি",
  fish: "মাছ",
  dairy: "দুগ্ধজাত",
  eggs: "ডিম",
  other: "অন্যান্য",
};

const STATUS_LABEL: Record<string, { label: string; color: string; bg: string }> = {
  active: { label: "সক্রিয়", color: "#027A48", bg: "#ECFDF3" },
  inactive: { label: "নিষ্ক্রিয়", color: "#B54708", bg: "#FFFAEB" },
  out_of_stock: { label: "স্টক শেষ", color: "#B42318", bg: "#FEF3F2" },
};

export default function MyProductsScreen() {
  const router = useRouter();
  const [editingProduct, setEditingProduct] = useState<any | null>(null);
  const [addModalVisible, setAddModalVisible] = useState(false);

  const {
    data: products = [],
    isLoading,
    isError,
    refetch,
  } = useGetMyProductsQuery();

  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [updateProduct] = useUpdateProductMutation();
  const [deleteProduct, { isLoading: deleting }] = useDeleteProductMutation();

  const handleToggleStatus = async (product: any) => {
    const newStatus = product.status === "active" ? "inactive" : "active";
    setTogglingId(product.id);
    try {
      await updateProduct({ id: product.id, status: newStatus }).unwrap();
    } catch {
      // silently ignore
    } finally {
      setTogglingId(null);
    }
  };

  const handleDelete = (product: any) => {
    Alert.alert(
      "পণ্য মুছে ফেলুন",
      `"${product.name}" পণ্যটি স্থায়ীভাবে মুছে ফেলতে চান?`,
      [
        { text: "বাতিল", style: "cancel" },
        {
          text: "মুছে ফেলুন",
          style: "destructive",
          onPress: async () => {
            try {
              await deleteProduct(product.id).unwrap();
            } catch {
              Alert.alert("ত্রুটি", "পণ্য মুছতে ব্যর্থ হয়েছে। আবার চেষ্টা করুন।");
            }
          },
        },
      ],
    );
  };

  const openEdit = (product: any) => {
    setEditingProduct(product);
    setAddModalVisible(true);
  };

  const closeModal = () => {
    setAddModalVisible(false);
    setEditingProduct(null);
  };

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      {/* Header */}
      <View className="flex-row items-center justify-between border-b border-border bg-white px-5 py-3.5">
        <View className="flex-row items-center gap-3">
          <Pressable
            onPress={() => router.back()}
            className="h-10 w-10 items-center justify-center rounded-full bg-neutral"
          >
            <Ionicons name="arrow-back" size={20} color={colors.ink} />
          </Pressable>
          <View>
            <AppText variant="subtitle" className="font-bengali-bold text-ink">
              আমার পণ্যসমূহ
            </AppText>
            {products.length > 0 ? (
              <AppText variant="caption" className="text-muted">
                মোট {new Intl.NumberFormat("bn-BD").format(products.length)}টি পণ্য
              </AppText>
            ) : null}
          </View>
        </View>
        <Pressable
          onPress={() => {
            setEditingProduct(null);
            setAddModalVisible(true);
          }}
          className="flex-row items-center gap-1.5 rounded-full bg-primary px-4 py-2"
        >
          <Ionicons name="add" size={18} color={colors.white} />
          <AppText variant="caption" className="font-bengali-bold text-white">
            পণ্য যোগ করুন
          </AppText>
        </Pressable>
      </View>

      {isError ? (
        <RetryCard
          message="পণ্যের তালিকা আনা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।"
          onRetry={refetch}
        />
      ) : isLoading ? (
        <View className="flex-1 px-5 py-5 gap-3">
          <AIGeneratingShimmer label="পণ্যের তালিকা লোড হচ্ছে" lines={5} className="w-full" />
        </View>
      ) : products.length === 0 ? (
        <View className="flex-1 items-center justify-center px-5">
          <EmptyState
            icon={<Ionicons name="cube-outline" size={40} color={colors.primary} />}
            message="আপনার দোকানে এখনো কোনো পণ্য নেই।"
            ctaLabel="প্রথম পণ্য যোগ করুন"
            onCta={() => {
              setEditingProduct(null);
              setAddModalVisible(true);
            }}
          />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="gap-3 px-5 py-5 pb-24"
          showsVerticalScrollIndicator={false}
        >
          {products.map((product: any) => {
            const statusInfo = STATUS_LABEL[product.status] ?? STATUS_LABEL.inactive;
            const imageUrl = product.images?.[0]?.url;
            const categoryLabel = CATEGORY_LABELS[product.category] ?? product.category;

            return (
              <View
                key={product.id}
                className="overflow-hidden rounded-3xl bg-white shadow-sm"
              >
                {/* Product Row */}
                <View className="flex-row gap-3 p-4">
                  {/* Thumbnail */}
                  <View className="h-20 w-20 overflow-hidden rounded-2xl bg-neutral">
                    {imageUrl ? (
                      <Image
                        source={{ uri: imageUrl }}
                        className="h-full w-full"
                        resizeMode="cover"
                      />
                    ) : (
                      <View className="h-full w-full items-center justify-center bg-primary/10">
                        <Ionicons name="cube" size={28} color={colors.primary} />
                      </View>
                    )}
                  </View>

                  {/* Product Info */}
                  <View className="flex-1 gap-1">
                    <View className="flex-row items-start justify-between">
                      <AppText
                        variant="body"
                        className="font-bengali-bold text-ink flex-1 pr-2"
                        numberOfLines={2}
                      >
                        {product.name}
                      </AppText>
                      {/* Status Badge */}
                      <View
                        className="rounded-full px-2.5 py-0.5"
                        style={{ backgroundColor: statusInfo.bg }}
                      >
                        <AppText
                          variant="caption"
                          style={{ color: statusInfo.color }}
                          className="font-bengali-bold"
                        >
                          {statusInfo.label}
                        </AppText>
                      </View>
                    </View>

                    <AppText variant="caption" className="text-muted">
                      {categoryLabel}
                      {product.isOrganic ? " · 🌿 জৈব" : ""}
                    </AppText>

                    <View className="flex-row items-center gap-3 mt-1">
                      <AppText variant="body" className="font-bengali-bold text-primary">
                        ৳ {product.pricePerUnit}/{product.unit}
                      </AppText>
                      <AppText variant="caption" className="text-muted">
                        মজুদ: {product.availableQuantity} {product.unit}
                      </AppText>
                    </View>
                  </View>
                </View>

                {/* Action Buttons */}
                <View className="flex-row border-t border-neutral">
                  {/* Toggle Active/Inactive */}
                  <Pressable
                    onPress={() => handleToggleStatus(product)}
                    disabled={togglingId === product.id}
                    className="flex-1 flex-row items-center justify-center gap-1.5 py-3"
                  >
                    <Ionicons
                      name={product.status === "active" ? "eye-off-outline" : "eye-outline"}
                      size={16}
                      color={product.status === "active" ? colors.muted : colors.primary}
                    />
                    <AppText
                      variant="caption"
                      className="font-bengali-semibold"
                      style={{
                        color: product.status === "active" ? colors.muted : colors.primary,
                      }}
                    >
                      {product.status === "active" ? "নিষ্ক্রিয় করুন" : "সক্রিয় করুন"}
                    </AppText>
                  </Pressable>

                  <View className="w-px bg-neutral" />

                  {/* Edit */}
                  <Pressable
                    onPress={() => openEdit(product)}
                    className="flex-1 flex-row items-center justify-center gap-1.5 py-3"
                  >
                    <Ionicons name="create-outline" size={16} color={colors.ink} />
                    <AppText variant="caption" className="font-bengali-semibold text-ink">
                      সম্পাদনা
                    </AppText>
                  </Pressable>

                  <View className="w-px bg-neutral" />

                  {/* Delete */}
                  <Pressable
                    onPress={() => handleDelete(product)}
                    disabled={deleting}
                    className="flex-1 flex-row items-center justify-center gap-1.5 py-3"
                  >
                    <Ionicons name="trash-outline" size={16} color="#B42318" />
                    <AppText
                      variant="caption"
                      className="font-bengali-semibold"
                      style={{ color: "#B42318" }}
                    >
                      মুছুন
                    </AppText>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </ScrollView>
      )}

      {/* Add / Edit Product Modal */}
      <AddProductModal
        visible={addModalVisible}
        onClose={closeModal}
        existingProduct={editingProduct}
      />
    </SafeAreaView>
  );
}

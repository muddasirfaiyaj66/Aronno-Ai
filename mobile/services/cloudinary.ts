const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export type CloudinaryUploadResult = {
  url: string;
  publicId: string;
};

/**
 * Upload a local image URI directly to Cloudinary using an unsigned upload preset.
 * Returns the hosted URL (used in most places in the app).
 */
export async function uploadImageToCloudinary(localUri: string): Promise<string> {
  const result = await uploadImageWithMeta(localUri);
  return result.url;
}

/**
 * Upload a local image URI directly to Cloudinary and return both the URL and publicId.
 * Used by ProductImagePicker so we can track publicId for later deletion.
 */
export async function uploadImageWithMeta(localUri: string): Promise<CloudinaryUploadResult> {
  if (localUri.startsWith("https://") || localUri.startsWith("http://")) {
    // Already hosted — extract publicId from URL if possible
    const match = localUri.match(/\/upload\/(?:v\d+\/)?(.+?)(?:\.\w+)?$/);
    return { url: localUri, publicId: match?.[1] ?? "" };
  }

  if (!CLOUD_NAME || !UPLOAD_PRESET) {
    throw new Error(
      "ছবি আপলোড সেটআপ সম্পূর্ণ নয়। অ্যাপে ইন্টারনেট কনফিগ ঠিক করুন।",
    );
  }

  const name = localUri.split("/").pop() ?? "photo.jpg";
  const form = new FormData();
  form.append("file", {
    uri: localUri,
    name,
    type: "image/jpeg",
  } as unknown as Blob);
  form.append("upload_preset", UPLOAD_PRESET);

  console.log("[Cloudinary] Uploading to cloud:", CLOUD_NAME, "preset:", UPLOAD_PRESET);
  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: form },
  );
  const json = (await res.json()) as {
    secure_url?: string;
    public_id?: string;
    error?: { message?: string };
  };
  console.log("[Cloudinary] Response status:", res.status, "body:", JSON.stringify(json));

  if (!res.ok || typeof json.secure_url !== "string") {
    throw new Error(
      json.error?.message ?? "ছবি আপলোড করা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।",
    );
  }

  return {
    url: json.secure_url,
    publicId: json.public_id ?? "",
  };
}

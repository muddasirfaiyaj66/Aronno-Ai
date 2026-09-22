const CLOUD_NAME = process.env.EXPO_PUBLIC_CLOUDINARY_CLOUD_NAME;
const UPLOAD_PRESET = process.env.EXPO_PUBLIC_CLOUDINARY_UPLOAD_PRESET;

export async function uploadImageToCloudinary(localUri: string): Promise<string> {
  if (localUri.startsWith("https://") || localUri.startsWith("http://")) {
    return localUri;
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

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${CLOUD_NAME}/image/upload`,
    { method: "POST", body: form },
  );
  const json = (await res.json()) as { secure_url?: string; error?: { message?: string } };
  if (!res.ok || typeof json.secure_url !== "string") {
    throw new Error("ছবি আপলোড করা যায়নি। ইন্টারনেট দেখে আবার চেষ্টা করুন।");
  }
  return json.secure_url;
}

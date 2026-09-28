import { useEffect, useRef, useState } from "react";
import { Platform, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import * as Google from "expo-auth-session/providers/google";
import * as WebBrowser from "expo-web-browser";
import { AppText, SecondaryButton } from "@/components/ui";
import { colors } from "@/constants/theme";
import { useGoogleLoginMutation } from "@/services/api";
import { userFacingError } from "@/lib/userFacingError";

WebBrowser.maybeCompleteAuthSession();

function clientIdForPlatform() {
  const web =
    process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID ||
    process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ||
    "";
  const android = process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID || "";
  const ios = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID || "";
  if (Platform.OS === "android") return { web, android, ios, active: android };
  if (Platform.OS === "ios") return { web, android, ios, active: ios };
  return { web, android, ios, active: web };
}

function reversedRedirect(clientId: string) {
  const prefix = clientId.replace(/\.apps\.googleusercontent\.com$/, "");
  if (!prefix || prefix === clientId) return undefined;
  return `com.googleusercontent.apps.${prefix}:/oauthredirect`;
}

export function GoogleSignInButton() {
  const ids = clientIdForPlatform();
  if (!ids.active) {
    return (
      <AppText variant="caption" className="text-center text-muted">
        গুগল লগইন চালু করতে এই ফোনের গুগল ক্লায়েন্ট আইডি লাগবে।
      </AppText>
    );
  }
  return <GoogleSignInReady ids={ids} />;
}

function GoogleSignInReady({
  ids,
}: {
  ids: ReturnType<typeof clientIdForPlatform>;
}) {
  const router = useRouter();
  const [googleLogin, { isLoading }] = useGoogleLoginMutation();
  const [message, setMessage] = useState<string | null>(null);
  const started = useRef(false);
  const redirectUri =
    Platform.OS === "web" ? undefined : reversedRedirect(ids.active);

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: ids.web || ids.active,
    androidClientId: ids.android || ids.active,
    iosClientId: ids.ios || ids.active,
    redirectUri,
    selectAccount: true,
    language: "bn",
  });

  useEffect(() => {
    if (response?.type === "dismiss" || response?.type === "cancel") {
      started.current = false;
      return;
    }
    if (response?.type === "error") {
      started.current = false;
      setMessage("গুগল লগইন সম্পন্ন হয়নি। আবার চেষ্টা করুন।");
      return;
    }
    if (response?.type !== "success") return;
    const idToken = response.authentication?.idToken || response.params.id_token;
    if (!idToken || started.current) return;
    started.current = true;
    void googleLogin({ idToken })
      .unwrap()
      .then(() => router.replace("/(root)/(tabs)"))
      .catch((error) => {
        started.current = false;
        setMessage(
          userFacingError(error, "auth", "গুগল লগইন হয়নি। ইমেইল দিয়ে চেষ্টা করুন।"),
        );
      });
  }, [googleLogin, response, router]);

  return (
    <View className="gap-2">
      <SecondaryButton
        label="গুগল দিয়ে লগইন"
        loading={isLoading}
        disabled={!request}
        onPress={() => {
          setMessage(null);
          void promptAsync();
        }}
        icon={<Ionicons name="logo-google" size={18} color={colors.primary} />}
      />
      {message ? (
        <AppText variant="caption" className="text-center text-severity-high">
          {message}
        </AppText>
      ) : null}
    </View>
  );
}

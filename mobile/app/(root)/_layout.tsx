import { useEffect, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Redirect, Stack } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ONBOARDING_STORAGE_KEY } from "@/utils/onboarding";
import { useAppSelector } from "@/store";
import { useGetMeQuery } from "@/services/api";
import { colors } from "@/constants/theme";

const AUTH_WAIT_MS = 5000;

function BootPlaceholder() {
  return (
    <View
      style={{
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: colors.neutral,
      }}
    >
      <ActivityIndicator size="large" color={colors.primary} />
    </View>
  );
}

export default function RootGroupLayout() {
  const [checked, setChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const [authWaitExpired, setAuthWaitExpired] = useState(false);
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const { isLoading, isError } = useGetMeQuery();

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_STORAGE_KEY)
      .then((value) => {
        setNeedsOnboarding(value !== "true");
        setChecked(true);
      })
      .catch(() => {
        setNeedsOnboarding(true);
        setChecked(true);
      });
  }, []);

  useEffect(() => {
    if (!isLoading) {
      setAuthWaitExpired(false);
      return;
    }
    const t = setTimeout(() => setAuthWaitExpired(true), AUTH_WAIT_MS);
    return () => clearTimeout(t);
  }, [isLoading]);

  // Onboarding does not need /auth/me — don't block it behind a hung request.
  if (!checked) return <BootPlaceholder />;
  if (needsOnboarding) return <Redirect href="/onboarding" />;

  // Waiting on session hydrate; show spinner instead of a blank white screen.
  if (isLoading && !authWaitExpired && !isAuthenticated) {
    return <BootPlaceholder />;
  }

  if (isError || authWaitExpired || !isAuthenticated) {
    return <Redirect href="/login" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.neutral },
      }}
    />
  );
}

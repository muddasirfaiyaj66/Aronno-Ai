import { useEffect, useState } from "react";
import { Redirect, Stack } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ONBOARDING_STORAGE_KEY } from "@/utils/onboarding";
import { useAppSelector } from "@/store";
import { useGetMeQuery } from "@/services/api";

export default function RootGroupLayout() {
  const [checked, setChecked] = useState(false);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);
  const isAuthenticated = useAppSelector((s) => s.auth.isAuthenticated);
  const { isLoading, isError } = useGetMeQuery();

  useEffect(() => {
    AsyncStorage.getItem(ONBOARDING_STORAGE_KEY).then((value) => {
      setNeedsOnboarding(value !== "true");
      setChecked(true);
    });
  }, []);

  if (!checked || isLoading) return null;
  if (needsOnboarding) return <Redirect href="/onboarding" />;
  if (isError || !isAuthenticated) return <Redirect href="/login" />;

  return <Stack screenOptions={{ headerShown: false }} />;
}

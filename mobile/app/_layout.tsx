import "../global.css";
import { useEffect } from "react";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useFonts } from "expo-font";
import * as SplashScreen from "expo-splash-screen";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider } from "react-redux";
import {
  NotoSansBengali_400Regular,
  NotoSansBengali_500Medium,
  NotoSansBengali_600SemiBold,
  NotoSansBengali_700Bold,
} from "@expo-google-fonts/noto-sans-bengali";
import { OfflineBanner } from "@/components/ui";
import { NotificationSync } from "@/components/NotificationSync";
import { OfflineAiBootstrap } from "@/components/OfflineAiBootstrap";
import { LocaleProvider } from "@/context/locale";
import { ThemeProvider, useTheme } from "@/context/theme";
import { store } from "@/store";
import { useGetMeQuery } from "@/services/api";

SplashScreen.preventAutoHideAsync();

function SessionHydrator() {
  useGetMeQuery();
  return null;
}

function ThemedStatusBar() {
  const { scheme } = useTheme();
  return <StatusBar style={scheme === "dark" ? "light" : "dark"} />;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    NotoSansBengali_400Regular,
    NotoSansBengali_500Medium,
    NotoSansBengali_600SemiBold,
    NotoSansBengali_700Bold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <Provider store={store}>
      <SafeAreaProvider>
        <ThemeProvider>
          <LocaleProvider>
            <SessionHydrator />
            <OfflineAiBootstrap />
            <NotificationSync />
            <ThemedStatusBar />
            <OfflineBanner />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: "transparent" },
              }}
            />
          </LocaleProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </Provider>
  );
}

import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SettingsScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-slate-50" edges={["top"]}>
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-center text-2xl font-bold text-slate-900">
          Settings
        </Text>
        <Text className="mt-2 text-center text-sm text-slate-500">
          Coming soon
        </Text>
      </View>
    </SafeAreaView>
  );
}

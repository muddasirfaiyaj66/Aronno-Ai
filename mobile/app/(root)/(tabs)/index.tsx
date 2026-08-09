import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function HomeScreen() {
  return (
    <SafeAreaView style={{ flex: 1 }} className="bg-slate-50" edges={["top"]}>
      <View className="flex-1 items-center justify-center px-8">
        <Text className="text-center text-3xl font-bold text-primary">
          Aronno!!
        </Text>
        <Text className="mt-3 text-center text-base leading-6 text-slate-500">
          Coming soon
        </Text>
      </View>
    </SafeAreaView>
  );
}

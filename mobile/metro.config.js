const path = require("path");
const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Ship TFLite binaries from assets/models/vision/
config.resolver.assetExts = [
  ...new Set([...(config.resolver.assetExts ?? []), "tflite"]),
];

// react-native-fast-tflite commonjs build requires ../spec from lib/commonjs,
// which wrongly resolves to lib/spec. Point it at the real package-root spec.
const nativeRNTflite = path.resolve(
  __dirname,
  "node_modules/react-native-fast-tflite/spec/NativeRNTflite.ts",
);
const upstreamResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (
    moduleName === "../spec/NativeRNTflite" ||
    moduleName.endsWith("/spec/NativeRNTflite")
  ) {
    return { type: "sourceFile", filePath: nativeRNTflite };
  }
  if (typeof upstreamResolveRequest === "function") {
    return upstreamResolveRequest(context, moduleName, platform);
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./global.css" });

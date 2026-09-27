const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");

const config = getDefaultConfig(__dirname);

// Do not crawl huge on-device model downloads — saves Metro heap on Windows.
const blockExtra = [
  /\.gguf$/,
  /\.onnx$/,
];
const prevBlock = config.resolver.blockList;
config.resolver.blockList = Array.isArray(prevBlock)
  ? [...prevBlock, ...blockExtra]
  : prevBlock
    ? [prevBlock, ...blockExtra]
    : blockExtra;

module.exports = withNativeWind(config, { input: "./global.css" });

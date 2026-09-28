module.exports = ({ config }) => {
  const googleSchemes = [
    reversedClientScheme(process.env.EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID),
    reversedClientScheme(process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID),
  ].filter(Boolean);

  return {
    ...config,
    scheme: ["aronno", ...new Set(googleSchemes)],
  };
};

function reversedClientScheme(clientId) {
  if (!clientId) return null;
  const prefix = String(clientId)
    .trim()
    .replace(/\.apps\.googleusercontent\.com$/, "");
  if (!prefix || prefix.includes(" ")) return null;
  if (!String(clientId).includes(".apps.googleusercontent.com")) return null;
  return `com.googleusercontent.apps.${prefix}`;
}

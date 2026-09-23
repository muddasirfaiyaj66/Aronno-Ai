#!/usr/bin/env bash
# Test on a phone against the backend running on this Mac.
# Detects the Mac's Wi-Fi IP, points the app at http://<ip>:3000/api and
# starts Metro — scan the printed QR from inside the phone app.
#
#   pnpm dev:phone              # Aronno dev APK (expo-dev-client), local backend
#   GO=1 pnpm dev:phone         # Expo Go instead of the Aronno APK
#   API=prod pnpm dev:phone     # use the deployed Vercel API instead of this Mac
#
# Expo Go has no llama.rn / sherpa-onnx / TFLite / BLE natives, so offline
# Gemma, offline voice, the on-device leaf model and live soil sensors only
# work in the Aronno APK.
set -euo pipefail
cd "$(dirname "$0")/.."

IP="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
if [ -z "$IP" ]; then
  echo "Could not find this Mac's Wi-Fi IP. Is Wi-Fi connected?" >&2
  exit 1
fi

export REACT_NATIVE_PACKAGER_HOSTNAME="$IP"
# Never print the "_expo/loading" chooser QR — apps that scan it try to load
# that web page as the bundle and fail.
export EXPO_NO_REDIRECT_PAGE=1

if [ "${API:-local}" = "prod" ]; then
  export EXPO_PUBLIC_API_URL="https://aronno-api.vercel.app/api"
else
  export EXPO_PUBLIC_API_URL="http://$IP:3000/api"
  if ! curl -s -m 3 -o /dev/null "http://localhost:3000/api/health"; then
    echo "⚠  Backend is not running on :3000 — start it in another terminal:"
    echo "     cd backend && npm run start:dev"
    echo
  fi
fi

echo "Phone and Mac must be on the same Wi-Fi."
echo "Metro: http://$IP:8081   API: $EXPO_PUBLIC_API_URL"
if [ -n "${GO:-}" ]; then
  MODE=--go
  echo "Open Expo Go → \"Scan QR code\" → scan the QR below."
  echo "Or Expo Go → \"Enter URL manually\":  exp://$IP:8081"
else
  MODE=--dev-client
  echo "Open the Aronno app → scan the QR below."
  echo "Or Aronno → \"Enter URL manually\":  http://$IP:8081"
fi
echo

exec node --max-old-space-size=8192 ./node_modules/expo/bin/cli start "$MODE" -c

#!/bin/sh
set -eu
cd "$(dirname "$0")/.."
if [ ! -f .env ]; then
  echo "Create call/.env from call/.env.example first." >&2
  exit 1
fi
set -a
. ./.env
set +a
envsubst < livekit.yaml.template > livekit.generated.yaml
echo "Wrote livekit.generated.yaml"

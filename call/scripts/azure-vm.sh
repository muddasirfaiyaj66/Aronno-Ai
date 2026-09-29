#!/bin/sh
# Creates the video VM in the Azure for Students subscription.
# Run this on a machine that is already signed in: az login
set -eu

RG="${RG:-aronno-call}"
NAME="${NAME:-aronno-call}"
# Student subscriptions cannot deploy in Southeast Asia. Allowed nearby
# regions are eastasia, malaysiawest, indiasouthcentral, indonesiacentral, centralindia.
# Standard_B2s is capacity-restricted in centralindia, so try other regions first.
LOCATION="${LOCATION:-eastasia}"
SIZE="${SIZE:-Standard_B2s}"

# The group may already exist in another region. A VM can still be created
# in an allowed location inside that group.
if ! az group show --name "$RG" >/dev/null 2>&1; then
  az group create --name "$RG" --location "$LOCATION"
fi

if az vm show --resource-group "$RG" --name "$NAME" >/dev/null 2>&1; then
  echo "VM $NAME already exists."
else
  created=0
  # One location override still wins. Otherwise walk allowed region/size pairs.
  if [ -n "${LOCATION_OVERRIDE:-}" ]; then
    pairs="$LOCATION $SIZE"
  else
    pairs="eastasia Standard_B2s
malaysiawest Standard_B2s
indiasouthcentral Standard_B2s
indonesiacentral Standard_B2s
eastasia Standard_B2ms
malaysiawest Standard_B2ms
eastasia Standard_B2als_v2
malaysiawest Standard_B2als_v2
indiasouthcentral Standard_B2als_v2
centralindia Standard_B2ms"
  fi
  while IFS= read -r pair; do
    [ -n "$pair" ] || continue
    # shellcheck disable=SC2086
    set -- $pair
    loc=$1
    size=$2
    echo "Trying $size in $loc"
    if az vm create \
      --resource-group "$RG" \
      --name "$NAME" \
      --image Ubuntu2204 \
      --size "$size" \
      --location "$loc" \
      --admin-username azureuser \
      --generate-ssh-keys \
      --public-ip-sku Standard
    then
      created=1
      break
    fi
    echo "Not available: $size in $loc"
  done <<EOF
$pairs
EOF
  if [ "$created" -ne 1 ]; then
    echo "No allowed region accepted a 2-vCPU size. Do not add a payment card."
    exit 1
  fi
fi

# az vm create already allows TCP 22 as default-allow-ssh at priority 1000.
NSG="${NAME}NSG"
ensure_port() {
  port=$1
  priority=$2
  if ! az network nsg rule show --resource-group "$RG" --nsg-name "$NSG" --name "open-port-$port" >/dev/null 2>&1; then
    az vm open-port --resource-group "$RG" --name "$NAME" --port "$port" --priority "$priority"
  fi
}
ensure_udp() {
  rule=$1
  priority=$2
  ports=$3
  if ! az network nsg rule show --resource-group "$RG" --nsg-name "$NSG" --name "$rule" >/dev/null 2>&1; then
    az network nsg rule create --nsg-name "$NSG" --resource-group "$RG" \
      --name "$rule" --priority "$priority" --access Allow --protocol Udp \
      --direction Inbound --destination-port-ranges "$ports"
  fi
}
ensure_port 80 1010
ensure_port 443 1020
ensure_port 7881 1030
ensure_udp allow-turn-udp 1040 443
ensure_udp allow-rtp-udp 1050 50000-60000

IP="$(az vm show -d --resource-group "$RG" --name "$NAME" --query publicIps -o tsv)"
echo "VM public IP: $IP"
echo "Point a DuckDNS hostname at this IP, fill call/.env, then on the VM:"
echo "  sudo apt-get update && sudo apt-get install -y docker.io docker-compose-v2 gettext-base"
echo "  sh scripts/render-livekit.sh && sudo docker compose up -d --build"

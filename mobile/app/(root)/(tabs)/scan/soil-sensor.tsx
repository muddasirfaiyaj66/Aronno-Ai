import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  AppText,
  FieldInput,
  PrimaryButton,
  RetryCard,
  ScreenHeader,
  SecondaryButton,
  StructuredCard,
} from "@/components/ui";
import { colors } from "@/constants/theme";
import {
  BLE_PROTOCOL,
  WIFI_PROTOCOL,
  getSoilSensorManager,
  recommendCropsFromSoil,
  type CropSuitability,
  type SensorMode,
  type SoilReading,
  type SoilSensorDevice,
  type SoilTransportKind,
} from "@/lib/soilSensor";

const FIT_BN: Record<CropSuitability["fit"], string> = {
  excellent: "খুব উপযোগী",
  good: "ভালো",
  fair: "মোটামুটি",
  poor: "কম উপযোগী",
};

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View className="min-w-[46%] flex-1 rounded-2xl bg-neutral px-3 py-3">
      <AppText variant="caption">{label}</AppText>
      <AppText variant="body" className="mt-1 font-bengali-bold text-ink">
        {value}
      </AppText>
    </View>
  );
}

export default function SoilSensorScreen() {
  const manager = useMemo(() => getSoilSensorManager(), []);
  const [snap, setSnap] = useState(() => manager.getSnapshot());
  const [devices, setDevices] = useState<SoilSensorDevice[]>([]);
  const [wifiUrl, setWifiUrl] = useState<string>(WIFI_PROTOCOL.defaultBaseUrl);
  const [crops, setCrops] = useState<CropSuitability[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const unsub = manager.subscribe(() => setSnap(manager.getSnapshot()));
    return () => {
      unsub();
    };
  }, [manager]);

  const setMode = (mode: SensorMode) => {
    manager.setMode(mode);
    setDevices([]);
    setCrops([]);
  };

  const setTransport = (kind: SoilTransportKind) => {
    manager.setTransport(kind);
    setDevices([]);
    setCrops([]);
  };

  const onScanBle = useCallback(async () => {
    setBusy(true);
    setDevices([]);
    try {
      await manager.scan((d) => {
        setDevices((prev) =>
          prev.some((x) => x.id === d.id) ? prev : [...prev, d],
        );
      });
    } catch {
      // error in snap
    } finally {
      setBusy(false);
    }
  }, [manager]);

  const onConnectBle = async (device: SoilSensorDevice) => {
    setBusy(true);
    try {
      await manager.stopScan();
      await manager.connectBluetooth(device);
    } catch {
      // snap.error
    } finally {
      setBusy(false);
    }
  };

  const onConnectWifi = async () => {
    setBusy(true);
    try {
      await manager.connectWifi({ baseUrl: wifiUrl });
    } catch {
      // snap.error
    } finally {
      setBusy(false);
    }
  };

  const onRead = async () => {
    setBusy(true);
    try {
      const reading = await manager.read();
      setCrops(recommendCropsFromSoil(reading));
    } catch {
      // snap.error
    } finally {
      setBusy(false);
    }
  };

  const reading: SoilReading | null = snap.reading;
  const connected = snap.connected;

  return (
    <SafeAreaView className="flex-1 bg-neutral" edges={["top"]}>
      <ScreenHeader
        title="মাটির সেন্সর"
        subtitle="ব্লুটুথ বা ওয়াই‑ফাই — ক্ষেতের তথ্য পড়ে ফসল সুপারিশ"
      />

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 px-5 py-5 pb-24"
        keyboardShouldPersistTaps="handled"
      >
        <View className="flex-row gap-2">
          {(["demo", "live"] as const).map((mode) => {
            const active = snap.mode === mode;
            return (
              <Pressable
                key={mode}
                onPress={() => setMode(mode)}
                className={`flex-1 items-center rounded-2xl border px-3 py-3 ${
                  active ? "border-primary bg-secondary" : "border-border bg-white"
                }`}
              >
                <AppText
                  variant="body"
                  className={`font-bengali-bold ${active ? "text-primary" : "text-ink"}`}
                >
                  {mode === "demo" ? "ডেমো টেস্ট" : "আসল হার্ডওয়্যার"}
                </AppText>
                <AppText variant="caption" className="mt-1 text-center">
                  {mode === "demo"
                    ? "হার্ডওয়্যার ছাড়া UI পরীক্ষা"
                    : "BLE / Wi‑Fi প্রোব"}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        <View className="flex-row gap-2">
          {(["bluetooth", "wifi"] as const).map((kind) => {
            const active = snap.transport === kind;
            return (
              <Pressable
                key={kind}
                onPress={() => setTransport(kind)}
                className={`flex-1 flex-row items-center justify-center gap-2 rounded-2xl border px-3 py-3 ${
                  active ? "border-primary bg-white" : "border-border bg-white/70"
                }`}
              >
                <Ionicons
                  name={kind === "bluetooth" ? "bluetooth" : "wifi"}
                  size={20}
                  color={active ? colors.primary : colors.muted}
                />
                <AppText
                  variant="body"
                  className={`font-bengali-semibold ${active ? "text-primary" : "text-muted"}`}
                >
                  {kind === "bluetooth" ? "ব্লুটুথ" : "ওয়াই‑ফাই"}
                </AppText>
              </Pressable>
            );
          })}
        </View>

        {snap.mode === "live" && snap.transport === "bluetooth" ? (
          <AppText variant="caption" className="leading-6">
            নামের উপসর্গ `{BLE_PROTOCOL.namePrefix}` · সার্ভিস UUID{" "}
            `{BLE_PROTOCOL.serviceUuid.slice(0, 8)}…` — বিস্তারিত{" "}
            docs/hardware_soil_sensor.md
          </AppText>
        ) : null}

        {snap.transport === "bluetooth" ? (
          <View className="gap-3">
            <PrimaryButton
              label={snap.state === "scanning" ? "খুঁজছে…" : "কাছের সেন্সর খুঁজুন"}
              onPress={onScanBle}
              loading={busy && snap.state === "scanning"}
              disabled={busy}
              icon={<Ionicons name="search" size={20} color={colors.white} />}
            />
            {devices.map((d) => (
              <Pressable
                key={d.id}
                onPress={() => void onConnectBle(d)}
                className="flex-row items-center gap-3 rounded-2xl border border-border bg-white px-4 py-3"
              >
                <Ionicons name="hardware-chip-outline" size={22} color={colors.primary} />
                <View className="flex-1">
                  <AppText variant="body" className="font-bengali-bold text-ink">
                    {d.name}
                  </AppText>
                  <AppText variant="caption">
                    {d.mock ? "ডেমো" : d.id.slice(0, 12)}
                    {d.rssi != null ? ` · ${d.rssi} dBm` : ""}
                  </AppText>
                </View>
                <AppText variant="caption" className="text-primary">
                  সংযুক্ত
                </AppText>
              </Pressable>
            ))}
          </View>
        ) : (
          <View className="gap-3">
            <FieldInput
              label="সেন্সরের ঠিকানা (URL)"
              value={wifiUrl}
              onChangeText={(val) => setWifiUrl(val)}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder={WIFI_PROTOCOL.defaultBaseUrl}
            />
            <AppText variant="caption" className="leading-6">
              ফোনকে সেন্সরের Wi‑Fi (যেমন AronnoSoil‑XXXX)‑এ জুড়ে নিন, তারপর সংযুক্ত
              চাপুন। API: `{WIFI_PROTOCOL.readingPath}`
            </AppText>
            <PrimaryButton
              label="ওয়াই‑ফাইতে সংযুক্ত করুন"
              onPress={onConnectWifi}
              loading={busy && snap.state === "connecting"}
              disabled={busy}
              icon={<Ionicons name="wifi" size={20} color={colors.white} />}
            />
          </View>
        )}

        {connected ? (
          <View className="gap-3 rounded-2xl border border-primary/20 bg-secondary px-4 py-3">
            <AppText variant="body" className="font-bengali-bold text-primary">
              সংযুক্ত: {connected.name}
            </AppText>
            <AppText variant="caption">
              {connected.transport === "bluetooth" ? "ব্লুটুথ" : "ওয়াই‑ফাই"}
              {snap.mode === "demo" ? " · ডেমো মোড" : ""}
            </AppText>
            <View className="flex-row gap-2">
              <PrimaryButton
                label="মাটির তথ্য পড়ুন"
                onPress={onRead}
                loading={busy && snap.state === "reading"}
                disabled={busy}
                className="flex-1"
                icon={<Ionicons name="leaf" size={20} color={colors.white} />}
              />
              <SecondaryButton
                label="কাটুন"
                onPress={() => {
                  void manager.disconnect();
                  setCrops([]);
                }}
                className="flex-1"
              />
            </View>
          </View>
        ) : null}

        {snap.error ? (
          <RetryCard
            message={snap.error}
            onRetry={() => {
              if (snap.transport === "bluetooth") void onScanBle();
              else void onConnectWifi();
            }}
          />
        ) : null}

        {reading ? (
          <StructuredCard
            title="মাটির রিডিং"
            icon={<Ionicons name="analytics-outline" size={22} color={colors.primary} />}
          >
            <View className="flex-row flex-wrap gap-2">
              <Metric label="আর্দ্রতা" value={`${Math.round(reading.moisturePct)}%`} />
              <Metric label="তাপমাত্রা" value={`${reading.temperatureC.toFixed(1)}°C`} />
              <Metric label="pH" value={reading.ph.toFixed(1)} />
              <Metric label="EC" value={`${reading.ecMsCm.toFixed(2)} mS/cm`} />
              <Metric label="নাইট্রোজেন (N)" value={`${reading.nitrogenPpm} ppm`} />
              <Metric label="ফসফরাস (P)" value={`${reading.phosphorusPpm} ppm`} />
              <Metric label="পটাশিয়াম (K)" value={`${reading.potassiumPpm} ppm`} />
              {reading.batteryPct != null ? (
                <Metric label="ব্যাটারি" value={`${Math.round(reading.batteryPct)}%`} />
              ) : null}
            </View>
            <AppText variant="caption" className="mt-3">
              {new Date(reading.measuredAt).toLocaleString("bn-BD")} ·{" "}
              {reading.transport === "bluetooth" ? "BLE" : "Wi‑Fi"}
            </AppText>
          </StructuredCard>
        ) : null}

        {crops.length > 0 ? (
          <View className="gap-3">
            <AppText variant="body" className="font-bengali-bold text-ink">
              এই জমিতে উপযোগী ফসল
            </AppText>
            {crops.slice(0, 5).map((c) => (
              <View
                key={c.cropSlug}
                className="rounded-2xl border border-border bg-white px-4 py-3"
              >
                <View className="flex-row items-center justify-between">
                  <AppText variant="body" className="font-bengali-bold text-ink">
                    {c.nameBn}
                  </AppText>
                  <AppText variant="caption" className="text-primary">
                    {FIT_BN[c.fit]} · {c.score}
                  </AppText>
                </View>
                <AppText variant="caption" className="mt-2 leading-6">
                  {c.reasonsBn.slice(0, 2).join(" · ")}
                </AppText>
              </View>
            ))}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

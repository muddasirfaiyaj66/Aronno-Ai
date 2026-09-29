import { useEffect, useState } from "react";
import { ActivityIndicator, NativeModules, Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "@/components/ui";
import { colors } from "@/constants/theme";
import { joinCall, leaveCall, type JoinCallResult } from "@/services/callApi";

type LiveKitModule = typeof import("@livekit/react-native");

function loadLiveKit(): LiveKitModule | null {
  // The current dev build has no WebRTC binary. Requiring LiveKit throws before the call screen can explain that.
  if (NativeModules.WebRTCModule == null) return null;
  try {
    return require("@livekit/react-native") as LiveKitModule;
  } catch {
    return null;
  }
}

export default function ConsultCall() {
  const { consultId } = useLocalSearchParams<{ consultId: string }>();
  const id = typeof consultId === "string" ? consultId : "";
  const router = useRouter();
  const [session, setSession] = useState<JoinCallResult | null>(null);
  const [error, setError] = useState("");
  const livekit = loadLiveKit();

  useEffect(() => {
    if (!id || !livekit) return;
    livekit.registerGlobals();
    let alive = true;
    void joinCall(id)
      .then((next) => {
        if (alive) setSession(next);
      })
      .catch((err: unknown) => {
        if (alive) setError(err instanceof Error ? err.message : "কলে ঢোকা যায়নি।");
      });
    return () => {
      alive = false;
    };
  }, [id, livekit]);

  async function hangUp() {
    if (id) await leaveCall(id);
    router.back();
  }

  if (!livekit) {
    return (
      <CallNotice
        title="ভিডিও কলের জন্য নতুন অ্যাপ বিল্ড দরকার।"
        onBack={() => router.back()}
      />
    );
  }

  if (error || !session) {
    return (
      <CallNotice
        title={error || "কলে ঢুকছি…"}
        busy={!error}
        onBack={() => router.back()}
      />
    );
  }

  const { AudioSession, LiveKitRoom, VideoTrack, useTracks, isTrackReference } = livekit;
  const { Track } = require("livekit-client") as typeof import("livekit-client");

  return (
    <LiveKitRoom
      serverUrl={session.url}
      token={session.token}
      connect
      audio
      video={{
        resolution: {
          width: session.video.width,
          height: session.video.height,
          frameRate: 30,
        },
      }}
      options={{
        publishDefaults: {
          simulcast: false,
          videoEncoding: { maxBitrate: session.video.maxBitrate, maxFramerate: 30 },
        },
      }}
      onConnected={() => {
        void AudioSession.startAudioSession();
      }}
      onDisconnected={() => {
        void AudioSession.stopAudioSession();
      }}
    >
      <CallStage
        VideoTrack={VideoTrack}
        useTracks={useTracks}
        isTrackReference={isTrackReference}
        Track={Track}
        onHangUp={() => void hangUp()}
      />
    </LiveKitRoom>
  );
}

function CallNotice({
  title,
  busy = false,
  onBack,
}: {
  title: string;
  busy?: boolean;
  onBack: () => void;
}) {
  return (
    <View className="flex-1 items-center justify-center bg-neutral px-8">
      <View className="mb-4 h-16 w-16 items-center justify-center rounded-full bg-secondary">
        {busy ? (
          <ActivityIndicator color={colors.primary} />
        ) : (
          <Ionicons name="videocam-outline" size={28} color={colors.primary} />
        )}
      </View>
      <AppText variant="body" className="text-center">
        {title}
      </AppText>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="ফিরে যান"
        onPress={onBack}
        className="mt-6 min-h-touch items-center justify-center rounded-2xl border border-border bg-card px-6"
      >
        <AppText variant="body" className="font-bengali-semibold text-primary">
          ফিরে যান
        </AppText>
      </Pressable>
    </View>
  );
}

function CallStage({
  VideoTrack,
  useTracks,
  isTrackReference,
  Track,
  onHangUp,
}: {
  VideoTrack: LiveKitModule["VideoTrack"];
  useTracks: LiveKitModule["useTracks"];
  isTrackReference: LiveKitModule["isTrackReference"];
  Track: typeof import("livekit-client").Track;
  onHangUp: () => void;
}) {
  const insets = useSafeAreaInsets();
  const tracks = useTracks([Track.Source.Camera]);
  const remote = tracks.find((track) => isTrackReference(track) && !track.participant.isLocal);
  const local = tracks.find((track) => isTrackReference(track) && track.participant.isLocal);

  return (
    <View className="flex-1 bg-black">
      {remote && isTrackReference(remote) ? (
        <VideoTrack trackRef={remote} style={{ flex: 1 }} objectFit="cover" />
      ) : (
        <View className="flex-1 items-center justify-center px-8">
          <View className="mb-4 h-20 w-20 items-center justify-center rounded-full bg-white/10">
            <Ionicons name="person" size={36} color={colors.white} />
          </View>
          <AppText variant="bodyLg" className="text-center text-white">
            অপর পক্ষের অপেক্ষা
          </AppText>
        </View>
      )}

      <View
        className="absolute left-4 rounded-full bg-black/45 px-3 py-1.5"
        style={{ top: insets.top + 12 }}
      >
        <AppText variant="caption" className="font-bengali-semibold text-white">
          ভিডিও পরামর্শ
        </AppText>
      </View>

      {local && isTrackReference(local) ? (
        <View
          className="absolute right-4 h-44 w-28 overflow-hidden rounded-3xl border-2 border-white/80"
          style={{ bottom: insets.bottom + 108 }}
        >
          <VideoTrack trackRef={local} style={{ flex: 1 }} objectFit="cover" />
        </View>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel="কল শেষ"
        onPress={onHangUp}
        className="absolute self-center h-16 w-16 items-center justify-center rounded-full"
        style={{ bottom: insets.bottom + 28, backgroundColor: colors.danger }}
      >
        <Ionicons name="call" size={26} color={colors.white} style={{ transform: [{ rotate: "135deg" }] }} />
      </Pressable>
    </View>
  );
}

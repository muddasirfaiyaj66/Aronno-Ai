import { useEffect, useState } from "react";
import { ActivityIndicator, NativeModules, Pressable, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "@/components/ui";
import { colors } from "@/constants/theme";
import { setScreenRing, stopCallRing } from "@/lib/notifications/alert";
import { useAppSelector } from "@/store";
import { useGetConsultQuery } from "@/services/api";
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
  const insets = useSafeAreaInsets();
  const me = useAppSelector((s) => s.auth.user);
  const { data: consult, isError } = useGetConsultQuery(id, {
    skip: !id,
    pollingInterval: id ? 3000 : 0,
  });
  const [session, setSession] = useState<JoinCallResult | null>(null);
  const [error, setError] = useState("");
  const [answered, setAnswered] = useState(false);
  const livekit = loadLiveKit();
  const iAmFarmer = !!consult && !!me && consult.farmer.id === me.id;
  const iAmSpecialist = !!consult && !!me && consult.specialist?.id === me.id;
  const peerName = iAmSpecialist
    ? consult.farmer.displayName
    : consult?.specialist?.displayName ?? (consult ? "বিশেষজ্ঞ" : "সংযোগ হচ্ছে");
  const waitingForAnswer =
    !!livekit && iAmFarmer && consult.status === "ringing" && !answered && !session;
  const incomingAlert = iAmFarmer && consult?.status === "ringing" && !answered && !session;
  const canJoin =
    !!id &&
    !!livekit &&
    !!consult &&
    !!me &&
    !(iAmFarmer && consult.status === "ringing" && !answered);

  useEffect(() => {
    setScreenRing(incomingAlert);
    return () => {
      if (incomingAlert) setScreenRing(false);
    };
  }, [incomingAlert]);

  useEffect(() => {
    if (consult?.status && consult.status !== "ringing") stopCallRing();
  }, [consult?.status]);

  useEffect(() => {
    if (!canJoin || !livekit || !id) return;
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
  }, [canJoin, livekit, id]);

  function decline() {
    stopCallRing();
    if (canJoin || session) void leaveCall(id);
    router.back();
  }

  function answer() {
    stopCallRing();
    setAnswered(true);
  }

  if (!livekit) {
    return (
      <CallShell
        insets={insets}
        name={peerName}
        status="ভিডিও এখনো যুক্ত নয়"
        detail="ভিডিও কলের জন্য নতুন অ্যাপ বিল্ড দরকার।"
        hint="এই বিল্ডে ভিডিও যুক্ত নেই। নতুন অ্যাপ ইনস্টল হলে কল চালু হবে।"
        onDecline={() => {
          stopCallRing();
          router.back();
        }}
        declineLabel="ফিরে যান"
        showAnswer
        answerDisabled
      />
    );
  }

  if (isError) {
    return (
      <CallShell
        insets={insets}
        name="পরামর্শ"
        status="তালিকায় নেই"
        detail="এই পরামর্শ আর আপনার তালিকায় নেই।"
        onDecline={() => router.back()}
        declineLabel="ফিরে যান"
      />
    );
  }

  if (waitingForAnswer) {
    return (
      <CallShell
        insets={insets}
        name={peerName}
        status="কল আসছে"
        hint="ধরলে ভিডিও চালু হবে"
        onDecline={decline}
        onAnswer={answer}
        declineLabel="কাটুন"
        answerLabel="ধরুন"
        showAnswer
      />
    );
  }

  if (error || !session) {
    return (
      <CallShell
        insets={insets}
        name={peerName}
        status={error || (iAmSpecialist ? "কল করা হচ্ছে" : "কলে ঢুকছি…")}
        busy={!error}
        onDecline={decline}
        declineLabel={error ? "ফিরে যান" : "কাটুন"}
      />
    );
  }

  const {
    AudioSession,
    LiveKitRoom,
    VideoTrack,
    useTracks,
    isTrackReference,
    useLocalParticipant,
    useConnectionState,
    useRoomContext,
  } = livekit;
  const { Track, ConnectionState, facingModeFromLocalTrack } =
    require("livekit-client") as typeof import("livekit-client");

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
        adaptiveStream: false,
        dynacast: false,
        publishDefaults: {
          simulcast: false,
          videoEncoding: { maxBitrate: session.video.maxBitrate, maxFramerate: 30 },
        },
      }}
      onConnected={() => {
        stopCallRing();
        void AudioSession.startAudioSession();
      }}
      onDisconnected={() => {
        void AudioSession.stopAudioSession();
      }}
    >
      <CallStage
        name={peerName}
        VideoTrack={VideoTrack}
        useTracks={useTracks}
        isTrackReference={isTrackReference}
        useLocalParticipant={useLocalParticipant}
        useConnectionState={useConnectionState}
        useRoomContext={useRoomContext}
        Track={Track}
        ConnectionState={ConnectionState}
        facingModeFromLocalTrack={facingModeFromLocalTrack}
        capture={{ width: session.video.width, height: session.video.height }}
        onHangUp={decline}
      />
    </LiveKitRoom>
  );
}

function CallShell({
  insets,
  name,
  status,
  detail,
  hint,
  busy = false,
  onDecline,
  onAnswer,
  declineLabel,
  answerLabel = "ধরুন",
  showAnswer = false,
  answerDisabled = false,
}: {
  insets: { top: number; bottom: number };
  name: string;
  status: string;
  detail?: string;
  hint?: string;
  busy?: boolean;
  onDecline: () => void;
  onAnswer?: () => void;
  declineLabel: string;
  answerLabel?: string;
  showAnswer?: boolean;
  answerDisabled?: boolean;
}) {
  return (
    <LinearGradient
      colors={[colors.forest900, "#07312E"]}
      style={{ flex: 1, paddingTop: insets.top + 28, paddingBottom: insets.bottom + 28 }}
    >
      <View className="flex-1 items-center px-8">
        <AppText variant="caption" style={{ color: "rgba(255,255,255,0.75)" }}>
          ভিডিও পরামর্শ
        </AppText>
        <View
          className="mt-10 items-center justify-center rounded-full"
          style={{
            height: 168,
            width: 168,
            backgroundColor: "rgba(255,255,255,0.08)",
          }}
        >
          <View
            className="items-center justify-center rounded-full"
            style={{ height: 124, width: 124, backgroundColor: "rgba(255,255,255,0.14)" }}
          >
            {busy ? (
              <ActivityIndicator color={colors.white} size="large" />
            ) : (
              <Ionicons name="person" size={52} color={colors.white} />
            )}
          </View>
        </View>
        <AppText variant="display" className="mt-8 text-center" style={{ color: colors.white }}>
          {name}
        </AppText>
        <AppText variant="bodyLg" className="mt-2 text-center" style={{ color: "rgba(255,255,255,0.86)" }}>
          {status}
        </AppText>
        {detail ? (
          <View
            className="mt-6 w-full gap-2 rounded-3xl px-5 py-5"
            style={{ backgroundColor: colors.card }}
          >
            <View className="items-center">
              <Ionicons name="videocam-outline" size={26} color={colors.primary} />
            </View>
            <AppText variant="body" className="text-center" style={{ color: colors.ink }}>
              {detail}
            </AppText>
            {hint ? (
              <AppText variant="caption" className="text-center">
                {hint}
              </AppText>
            ) : null}
          </View>
        ) : hint ? (
          <AppText variant="caption" className="mt-3 text-center" style={{ color: "rgba(255,255,255,0.7)" }}>
            {hint}
          </AppText>
        ) : null}
      </View>
      <View className="flex-row items-end justify-center gap-16 px-8">
        <RoundAction
          label={declineLabel}
          icon="call"
          background={colors.danger}
          rotate
          onPress={onDecline}
        />
        {showAnswer ? (
          <RoundAction
            label={answerLabel}
            icon="call"
            background={colors.primary}
            disabled={answerDisabled}
            onPress={onAnswer}
          />
        ) : null}
      </View>
    </LinearGradient>
  );
}

function RoundAction({
  label,
  icon,
  background,
  iconColor = colors.white,
  onPress,
  disabled = false,
  rotate = false,
  checked,
  size = "lg",
}: {
  label: string;
  icon: "call" | "mic" | "mic-off" | "videocam" | "videocam-off" | "camera-reverse";
  background: string;
  iconColor?: string;
  onPress?: () => void;
  disabled?: boolean;
  rotate?: boolean;
  checked?: boolean;
  size?: "md" | "lg";
}) {
  const dimension = size === "lg" ? 72 : 58;
  return (
    <View className="flex-1 items-center gap-2">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ disabled, checked }}
        disabled={disabled || !onPress}
        onPress={onPress}
        className="items-center justify-center rounded-full"
        style={{
          height: dimension,
          width: dimension,
          backgroundColor: background,
          borderWidth: background === colors.white ? 2 : 0,
          borderColor: colors.primary,
          opacity: disabled ? 0.4 : 1,
        }}
      >
        <Ionicons
          name={icon}
          size={size === "lg" ? 30 : 26}
          color={iconColor}
          style={rotate ? { transform: [{ rotate: "135deg" }] } : undefined}
        />
      </Pressable>
      <AppText
        variant="caption"
        className="text-center"
        numberOfLines={2}
        style={{ color: colors.white, minHeight: 44 }}
      >
        {label}
      </AppText>
    </View>
  );
}

type ListedCamera = { deviceId: string; kind: string; facing?: string };

function listedCameras(value: unknown): ListedCamera[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const device = item as { deviceId?: unknown; kind?: unknown; facing?: unknown };
    if (device.kind !== "videoinput" || typeof device.deviceId !== "string") return [];
    return [{ deviceId: device.deviceId, kind: device.kind, facing: typeof device.facing === "string" ? device.facing : undefined }];
  });
}

function CallStage({
  name,
  VideoTrack,
  useTracks,
  isTrackReference,
  useLocalParticipant,
  useConnectionState,
  useRoomContext,
  Track,
  ConnectionState,
  facingModeFromLocalTrack,
  capture,
  onHangUp,
}: {
  name: string;
  VideoTrack: LiveKitModule["VideoTrack"];
  useTracks: LiveKitModule["useTracks"];
  isTrackReference: LiveKitModule["isTrackReference"];
  useLocalParticipant: LiveKitModule["useLocalParticipant"];
  useConnectionState: LiveKitModule["useConnectionState"];
  useRoomContext: LiveKitModule["useRoomContext"];
  Track: typeof import("livekit-client").Track;
  ConnectionState: typeof import("livekit-client").ConnectionState;
  facingModeFromLocalTrack: typeof import("livekit-client").facingModeFromLocalTrack;
  capture: { width: number; height: number };
  onHangUp: () => void;
}) {
  const insets = useSafeAreaInsets();
  const connection = useConnectionState();
  const room = useRoomContext();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled, cameraTrack } = useLocalParticipant();
  const [frontCamera, setFrontCamera] = useState(true);
  const [busy, setBusy] = useState<"mic" | "video" | "flip" | null>(null);
  const connected = connection === ConnectionState.Connected;
  const tracks = useTracks([Track.Source.Camera]);
  const remote = tracks.find((track) => isTrackReference(track) && !track.participant.isLocal);
  const local = tracks.find((track) => isTrackReference(track) && track.participant.isLocal);
  const remoteLive = !!(remote && isTrackReference(remote) && !remote.publication.isMuted);
  const localLive = !!(local && isTrackReference(local) && isCameraEnabled && !local.publication.isMuted);
  const mediaTrackId = cameraTrack?.videoTrack?.mediaStreamTrack.id;

  useEffect(() => {
    const media = cameraTrack?.videoTrack?.mediaStreamTrack;
    if (!media) return;
    setFrontCamera(facingModeFromLocalTrack(media).facingMode !== "environment");
  }, [cameraTrack?.videoTrack, facingModeFromLocalTrack, mediaTrackId]);

  async function toggleMic() {
    if (busy) return;
    setBusy("mic");
    try {
      await localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    } catch {
      // The participant flag stays on the last successful mute state.
    } finally {
      setBusy(null);
    }
  }

  async function toggleVideo() {
    if (busy) return;
    setBusy("video");
    try {
      await localParticipant.setCameraEnabled(!isCameraEnabled);
    } catch {
      // The participant flag stays on the last successful camera state.
    } finally {
      setBusy(null);
    }
  }

  async function flipCamera() {
    if (busy || !cameraTrack?.videoTrack) return;
    setBusy("flip");
    const nextFront = !frontCamera;
    try {
      const webrtc = require("@livekit/react-native-webrtc") as {
        mediaDevices: { enumerateDevices: () => Promise<unknown> };
      };
      const devices = listedCameras(await webrtc.mediaDevices.enumerateDevices());
      const wanted = nextFront ? ["front", "user"] : ["environment"];
      const match = devices.find((device) => device.facing != null && wanted.includes(device.facing));
      if (match) {
        const switched = await room.switchActiveDevice("videoinput", match.deviceId);
        if (switched) {
          setFrontCamera(nextFront);
          return;
        }
      }
      const videoTrack = cameraTrack.videoTrack as {
        isLocal: boolean;
        restartTrack?: (options?: {
          facingMode?: "user" | "environment";
          resolution?: { width: number; height: number; frameRate?: number };
        }) => Promise<void>;
      };
      if (videoTrack.isLocal && videoTrack.restartTrack) {
        await videoTrack.restartTrack({
          facingMode: nextFront ? "user" : "environment",
          resolution: { width: capture.width, height: capture.height, frameRate: 30 },
        });
        setFrontCamera(nextFront);
      }
    } catch {
      // Leave the camera label on the facing mode reported by the track.
    } finally {
      setBusy(null);
    }
  }

  return (
    <View className="flex-1" style={{ backgroundColor: remoteLive ? "#000000" : colors.forest900 }}>
      {remoteLive && remote && isTrackReference(remote) ? (
        <VideoTrack trackRef={remote} style={{ flex: 1 }} objectFit="cover" />
      ) : (
        <View className="flex-1 items-center justify-center px-8" style={{ paddingTop: insets.top }}>
          <View
            className="mb-6 items-center justify-center rounded-full"
            style={{ height: 124, width: 124, backgroundColor: "rgba(255,255,255,0.12)" }}
          >
            <Ionicons name={remote && isTrackReference(remote) ? "videocam-off" : "person"} size={48} color={colors.white} />
          </View>
          <AppText variant="title" className="text-center" style={{ color: colors.white }}>
            {name}
          </AppText>
          <AppText variant="body" className="mt-2 text-center" style={{ color: "rgba(255,255,255,0.8)" }}>
            {remote && isTrackReference(remote) ? "ক্যামেরা বন্ধ" : "অপর পক্ষের অপেক্ষা"}
          </AppText>
        </View>
      )}

      <View
        className="absolute left-4 rounded-full px-3 py-1.5"
        style={{ top: insets.top + 12, backgroundColor: "rgba(0,0,0,0.4)" }}
      >
        <AppText variant="caption" className="font-bengali-semibold" style={{ color: colors.white }}>
          {remoteLive ? name : "ভিডিও পরামর্শ"}
        </AppText>
      </View>

      {connected && (localLive || !isCameraEnabled) ? (
        <View
          className="absolute right-4 h-44 w-28 overflow-hidden rounded-3xl border-2 border-white/80"
          style={{ bottom: insets.bottom + 168 }}
        >
          {localLive && local && isTrackReference(local) ? (
            <VideoTrack trackRef={local} style={{ flex: 1 }} objectFit="cover" />
          ) : (
            <View className="flex-1 items-center justify-center px-2" style={{ backgroundColor: "#07312E" }}>
              <Ionicons name="videocam-off" size={28} color={colors.white} />
              <AppText variant="caption" className="mt-2 text-center" style={{ color: colors.white }}>
                ক্যামেরা বন্ধ
              </AppText>
            </View>
          )}
        </View>
      ) : null}

      <View
        className="absolute left-0 right-0 flex-row items-end justify-center gap-2 px-3"
        style={{ bottom: insets.bottom + 16 }}
      >
        {connected ? (
          <RoundAction
            label={isMicrophoneEnabled ? "মাইক চালু" : "মাইক বন্ধ"}
            icon={isMicrophoneEnabled ? "mic" : "mic-off"}
            background={isMicrophoneEnabled ? colors.primary : colors.white}
            iconColor={isMicrophoneEnabled ? colors.white : colors.ink}
            checked={isMicrophoneEnabled}
            disabled={busy !== null}
            size="md"
            onPress={() => void toggleMic()}
          />
        ) : null}
        {connected ? (
          <RoundAction
            label={isCameraEnabled ? "ভিডিও চালু" : "ভিডিও বন্ধ"}
            icon={isCameraEnabled ? "videocam" : "videocam-off"}
            background={isCameraEnabled ? colors.primary : colors.white}
            iconColor={isCameraEnabled ? colors.white : colors.ink}
            checked={isCameraEnabled}
            disabled={busy !== null}
            size="md"
            onPress={() => void toggleVideo()}
          />
        ) : null}
        <RoundAction label="কাটুন" icon="call" background={colors.danger} rotate onPress={onHangUp} />
        {connected ? (
          <RoundAction
            label={frontCamera ? "সামনের ক্যামেরা" : "পেছনের ক্যামেরা"}
            icon="camera-reverse"
            background={frontCamera ? colors.primary : colors.white}
            iconColor={frontCamera ? colors.white : colors.ink}
            checked={frontCamera}
            disabled={busy !== null || !cameraTrack?.videoTrack}
            size="md"
            onPress={() => void flipCamera()}
          />
        ) : null}
      </View>
    </View>
  );
}

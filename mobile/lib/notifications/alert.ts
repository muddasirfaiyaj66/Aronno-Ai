import { Platform, Vibration } from "react-native";
import { Audio } from "expo-av";

/**
 * Device default notification tone + vibration.
 * Android plays Settings' default notification or ringtone URI (not a bundled file).
 * MediaPlayer is required because ExoPlayer often cannot open those settings URIs.
 * iOS has no public "user's notification tone" URI; we try the system UISounds, then vibration.
 * expo-audio / expo-notifications are not in this binary, so playback stays on expo-av which is already linked.
 */

const ANDROID_NOTIFICATION = "content://settings/system/notification_sound";
const ANDROID_RINGTONE = "content://settings/system/ringtone";

const IOS_NOTIFICATIONS = [
  "file:///System/Library/Audio/UISounds/sms-received1.caf",
  "file:///System/Library/Audio/UISounds/ReceivedMessage.caf",
  "file:///System/Library/Audio/UISounds/new-mail.caf",
];

const IOS_RINGTONES = [
  "file:///System/Library/Audio/UISounds/nano/ringback_tone_ansi.caf",
  "file:///System/Library/Audio/UISounds/nano/ringback_tone_aus.caf",
  "file:///System/Library/Audio/UISounds/sms-received1.caf",
];

/** AOSP config_defaultNotificationVibePattern. */
const NOTIFICATION_VIBRATION = [0, 250, 250, 250];
const CALL_VIBRATION = [0, 800, 400, 800, 1000];

type CueItem = { kind: string; priority?: string };

let popupOn = false;
let screenOn = false;
let playGen = 0;
let starting = false;
let soundFailed = false;
let ringSound: Audio.Sound | null = null;
let cueSound: Audio.Sound | null = null;
let vibeTimer: ReturnType<typeof setInterval> | null = null;

export function isIncomingCall(item: CueItem) {
  return item.kind === "consult" && item.priority === "emergency";
}

export function consultIdFromPath(pathname?: string) {
  const match = pathname?.match(/\/consult\/([a-f0-9]{24})/i);
  return match?.[1] ?? "";
}

function wantRing() {
  return popupOn || screenOn;
}

function stopVibration() {
  if (vibeTimer) {
    clearInterval(vibeTimer);
    vibeTimer = null;
  }
  Vibration.cancel();
}

function vibrateNotification() {
  if (Platform.OS === "web") return;
  if (Platform.OS === "android") Vibration.vibrate(NOTIFICATION_VIBRATION);
  else Vibration.vibrate();
}

function vibrateCall() {
  if (Platform.OS === "web") return;
  stopVibration();
  if (Platform.OS === "android") {
    Vibration.vibrate(CALL_VIBRATION, true);
    return;
  }
  Vibration.vibrate();
  vibeTimer = setInterval(() => {
    if (wantRing()) Vibration.vibrate();
  }, 1600);
}

async function cueMode() {
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    playThroughEarpieceAndroid: false,
    shouldDuckAndroid: true,
  });
}

async function loadUri(uri: string, loop: boolean) {
  const { sound } = await Audio.Sound.createAsync(
    { uri },
    {
      shouldPlay: true,
      isLooping: loop,
      volume: 1,
      androidImplementation: "MediaPlayer",
    },
    null,
    false,
  );
  return sound;
}

async function loadFirst(uris: string[], loop: boolean) {
  await cueMode();
  for (const uri of uris) {
    try {
      return await loadUri(uri, loop);
    } catch {
      // try the next system tone
    }
  }
  return null;
}

function notificationUris() {
  return Platform.OS === "android" ? [ANDROID_NOTIFICATION] : IOS_NOTIFICATIONS;
}

function ringtoneUris() {
  return Platform.OS === "android" ? [ANDROID_RINGTONE, ANDROID_NOTIFICATION] : IOS_RINGTONES;
}

function endRing() {
  playGen += 1;
  starting = false;
  soundFailed = false;
  stopVibration();
  const sound = ringSound;
  ringSound = null;
  if (sound) void sound.unloadAsync().catch(() => undefined);
}

async function beginRing() {
  if (ringSound || starting || soundFailed) return;
  const gen = ++playGen;
  starting = true;
  vibrateCall();
  try {
    const sound = await loadFirst(ringtoneUris(), true);
    if (gen !== playGen || !wantRing()) {
      await sound?.unloadAsync().catch(() => undefined);
      if (gen === playGen) stopVibration();
      return;
    }
    if (!sound) {
      soundFailed = true;
      return;
    }
    ringSound = sound;
  } catch {
    if (gen === playGen) soundFailed = true;
  } finally {
    if (gen === playGen) starting = false;
  }
}

function reconcile() {
  if (wantRing()) void beginRing();
  else endRing();
}

/** Incoming-call popup. Repeats until this and the call screen both release. */
export function setPopupRing(on: boolean, noticeId: string) {
  popupOn = on && noticeId.length > 0;
  reconcile();
}

/** Unanswered incoming call screen. */
export function setScreenRing(on: boolean) {
  screenOn = on;
  reconcile();
}

/** Answer, dismiss, or the call left `ringing`. */
export function stopCallRing() {
  popupOn = false;
  screenOn = false;
  endRing();
}

/** One default notification tone and the default notification vibration. */
export async function playNotificationCue() {
  if (wantRing() || ringSound) return;
  vibrateNotification();
  if (Platform.OS === "web") return;
  try {
    if (cueSound) {
      await cueSound.unloadAsync().catch(() => undefined);
      cueSound = null;
    }
    const sound = await loadFirst(notificationUris(), false);
    if (!sound || wantRing()) {
      await sound?.unloadAsync().catch(() => undefined);
      return;
    }
    cueSound = sound;
    sound.setOnPlaybackStatusUpdate((status) => {
      if (!status.isLoaded || !status.didJustFinish) return;
      if (cueSound === sound) cueSound = null;
      void sound.unloadAsync().catch(() => undefined);
    });
  } catch {
    // vibration already ran
  }
}

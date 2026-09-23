/**
 * Download / list / delete offline models under documentDirectory/models/.
 * Supports single-file (GGUF) and multi-file (STT/TTS/vision LLM) catalog entries
 * with pause / resume across network drops and app restarts.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import {
  MODEL_CATALOG,
  type ModelCatalogEntry,
  defaultDownloadUrl,
} from "@/lib/modelManager/catalog";

const MODELS_DIR = `${FileSystem.documentDirectory ?? ""}models/`;
const PAUSE_KEY = (id: string) => `@aronno/dl/${id}`;

export type DownloadPhase =
  | "idle"
  | "downloading"
  | "paused"
  | "verifying"
  | "error"
  | "done";

export type DownloadSnapshot = {
  modelId: string;
  phase: DownloadPhase;
  /** 0–1 overall progress across all files */
  progress: number;
  fileIndex: number;
  fileCount: number;
  messageBn?: string;
  /** Why download is paused — auto-resume only for network. */
  pauseReason?: "user" | "network";
};

type PausePersist = {
  modelId: string;
  fileIndex: number;
  progress: number;
  url: string;
  fileUri: string;
  resumeData?: string;
  options?: FileSystem.DownloadOptions;
};

type ActiveJob = {
  entry: ModelCatalogEntry;
  fileIndex: number;
  resumable: FileSystem.DownloadResumable | null;
  abort: boolean;
  paused: boolean;
  pauseReason?: "user" | "network";
};

const jobs = new Map<string, ActiveJob>();
const snapshots = new Map<string, DownloadSnapshot>();
const listeners = new Set<(s: DownloadSnapshot) => void>();

function emit(snap: DownloadSnapshot) {
  snapshots.set(snap.modelId, snap);
  listeners.forEach((fn) => {
    try {
      fn(snap);
    } catch {
      // ignore listener errors
    }
  });
}

export function getDownloadSnapshot(modelId: string): DownloadSnapshot | null {
  return snapshots.get(modelId) ?? null;
}

export function subscribeDownloads(
  fn: (s: DownloadSnapshot) => void,
): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

async function ensureDir(path = MODELS_DIR) {
  const info = await FileSystem.getInfoAsync(path);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(path, { intermediates: true });
  }
}

export function modelsRootDir(): string {
  return MODELS_DIR;
}

export function localPath(entry: ModelCatalogEntry): string {
  return `${MODELS_DIR}${entry.id}/${entry.file}`;
}

export function localDir(entry: ModelCatalogEntry): string {
  return `${MODELS_DIR}${entry.id}/`;
}

export function localMmprojPath(entry: ModelCatalogEntry): string | null {
  if (!entry.mmprojFile) return null;
  return `${MODELS_DIR}${entry.id}/${entry.mmprojFile}`;
}

type FileSpec = { relativePath: string; url: string; minBytes: number };

function fileSpecs(entry: ModelCatalogEntry): FileSpec[] {
  if (entry.files?.length) {
    return entry.files.map((f) => ({
      relativePath: f.relativePath,
      url: f.url,
      minBytes: minBytesForRelative(f.relativePath),
    }));
  }
  return [
    {
      relativePath: entry.file,
      url: defaultDownloadUrl(entry),
      minBytes: Math.max(
        1024 * 1024,
        Math.floor(entry.sizeMb * 1024 * 1024 * 0.45),
      ),
    },
  ];
}

/** Companion text/json can be tiny; weight files must be substantial. */
function minBytesForRelative(relativePath: string): number {
  const lower = relativePath.toLowerCase();
  if (
    lower.endsWith(".txt") ||
    lower.endsWith(".json") ||
    lower.endsWith(".md")
  ) {
    return 8;
  }
  if (lower.endsWith(".onnx")) return 32 * 1024;
  if (lower.includes("mmproj")) return 8 * 1024 * 1024;
  if (lower.endsWith(".gguf")) return 16 * 1024 * 1024;
  return 64 * 1024;
}

async function fileLooksInstalled(
  absolutePath: string,
  minBytes: number,
): Promise<boolean> {
  const info = await FileSystem.getInfoAsync(absolutePath);
  if (!info.exists) return false;
  return (info.size ?? 0) >= minBytes;
}

export async function isInstalled(entry: ModelCatalogEntry): Promise<boolean> {
  if (!FileSystem.documentDirectory) return false;
  // Drop obsolete base (non-instruct) Gemma file if present
  if (entry.id === "gemma3-270m-q8") {
    const obsolete = `${localDir(entry)}gemma-3-270m-Q8_0.gguf`;
    const dead = await FileSystem.getInfoAsync(obsolete);
    if (dead.exists) {
      await FileSystem.deleteAsync(obsolete, { idempotent: true }).catch(
        () => undefined,
      );
    }
  }
  const specs = fileSpecs(entry);
  for (const f of specs) {
    const ok = await fileLooksInstalled(
      `${localDir(entry)}${f.relativePath}`,
      f.minBytes,
    );
    if (!ok) return false;
  }
  return true;
}

export async function listInstalled(): Promise<ModelCatalogEntry[]> {
  const flags = await Promise.all(MODEL_CATALOG.map(isInstalled));
  return MODEL_CATALOG.filter((_, i) => flags[i]);
}

async function savePause(data: PausePersist): Promise<void> {
  await AsyncStorage.setItem(PAUSE_KEY(data.modelId), JSON.stringify(data));
}

async function loadPause(modelId: string): Promise<PausePersist | null> {
  const raw = await AsyncStorage.getItem(PAUSE_KEY(modelId));
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PausePersist;
  } catch {
    return null;
  }
}

async function clearPause(modelId: string): Promise<void> {
  await AsyncStorage.removeItem(PAUSE_KEY(modelId));
}

function makeResumable(
  url: string,
  dest: string,
  onByteProgress: (written: number, total: number) => void,
  resumeData?: string,
  options?: FileSystem.DownloadOptions,
): FileSystem.DownloadResumable {
  return FileSystem.createDownloadResumable(
    url,
    dest,
    options ?? {},
    (p) => {
      onByteProgress(p.totalBytesWritten, p.totalBytesExpectedToWrite || 0);
    },
    resumeData,
  );
}

async function persistActivePause(job: ActiveJob, progress: number) {
  if (!job.resumable) return;
  try {
    const pause = await job.resumable.pauseAsync();
    await savePause({
      modelId: job.entry.id,
      fileIndex: job.fileIndex,
      progress,
      url: pause.url,
      fileUri: pause.fileUri,
      resumeData: pause.resumeData,
      options: pause.options,
    });
  } catch {
    // If native pause fails, keep whatever we last saved
  }
}

async function runDownload(entry: ModelCatalogEntry): Promise<void> {
  if (!FileSystem.documentDirectory) {
    throw new Error("documentDirectory unavailable");
  }

  const existing = jobs.get(entry.id);
  // Already actively downloading (has live resumable)
  if (existing?.resumable && !existing.paused && !existing.abort) {
    return;
  }

  await ensureDir();
  await ensureDir(localDir(entry));

  const specs = fileSpecs(entry);
  const saved = await loadPause(entry.id);
  let startIndex = 0;
  let overallProgress = 0;

  if (saved && saved.modelId === entry.id) {
    startIndex = Math.min(saved.fileIndex, specs.length - 1);
    overallProgress = saved.progress || 0;
  }

  // Skip already-complete files
  while (startIndex < specs.length) {
    const done = await fileLooksInstalled(
      `${localDir(entry)}${specs[startIndex].relativePath}`,
      specs[startIndex].minBytes,
    );
    if (!done) break;
    startIndex += 1;
    overallProgress = startIndex / specs.length;
  }

  if (startIndex >= specs.length) {
    await clearPause(entry.id);
    emit({
      modelId: entry.id,
      phase: "done",
      progress: 1,
      fileIndex: specs.length,
      fileCount: specs.length,
      messageBn: "ডাউনলোড সম্পন্ন",
    });
    jobs.delete(entry.id);
    return;
  }

  const job: ActiveJob = {
    entry,
    fileIndex: startIndex,
    resumable: null,
    abort: false,
    paused: false,
  };
  jobs.set(entry.id, job);

  emit({
    modelId: entry.id,
    phase: "downloading",
    progress: overallProgress,
    fileIndex: startIndex,
    fileCount: specs.length,
    messageBn: "ডাউনলোড হচ্ছে…",
  });

  try {
    for (let i = startIndex; i < specs.length; i++) {
      if (job.abort) throw new Error("cancelled");
      job.fileIndex = i;
      const spec = specs[i];
      const dest = `${localDir(entry)}${spec.relativePath}`;
      await ensureDir(dest.replace(/[^/]+$/, ""));

      const already = await fileLooksInstalled(dest, spec.minBytes);
      if (already) {
        overallProgress = (i + 1) / specs.length;
        emit({
          modelId: entry.id,
          phase: "downloading",
          progress: overallProgress,
          fileIndex: i,
          fileCount: specs.length,
        });
        continue;
      }

      const baseProgress = i / specs.length;
      const weight = 1 / specs.length;

      const onBytes = (written: number, total: number) => {
        const frac = total > 0 ? Math.min(0.99, written / total) : 0;
        overallProgress = baseProgress + frac * weight;
        emit({
          modelId: entry.id,
          phase: job.paused ? "paused" : "downloading",
          progress: overallProgress,
          fileIndex: i,
          fileCount: specs.length,
          messageBn: job.paused ? "থামানো আছে" : "ডাউনলোড হচ্ছে…",
        });
      };

      // Resume this file if pause state matches
      let resumeData: string | undefined;
      let resumeUrl = spec.url;
      let resumeDest = dest;
      let resumeOpts: FileSystem.DownloadOptions | undefined;
      const pause = await loadPause(entry.id);
      if (
        pause &&
        pause.fileIndex === i &&
        pause.fileUri === dest &&
        pause.resumeData
      ) {
        resumeData = pause.resumeData;
        resumeUrl = pause.url || spec.url;
        resumeDest = pause.fileUri || dest;
        resumeOpts = pause.options;
      }

      const resumable = makeResumable(
        resumeUrl,
        resumeDest,
        onBytes,
        resumeData,
        resumeOpts,
      );
      job.resumable = resumable;

      let result: FileSystem.FileSystemDownloadResult | undefined;
      try {
        result = resumeData
          ? await resumable.resumeAsync()
          : await resumable.downloadAsync();
      } catch (err) {
        if (job.abort) throw new Error("cancelled");
        // User tapped pause — pauseDownload already persisted state
        if (job.paused && job.pauseReason === "user") {
          return;
        }
        // Network drop — try to snapshot pause so user can resume
        await persistActivePause(job, overallProgress);
        job.paused = true;
        job.pauseReason = "network";
        job.resumable = null;
        const msg =
          err instanceof Error ? err.message : "নেটওয়ার্ক ত্রুটি";
        emit({
          modelId: entry.id,
          phase: "paused",
          progress: overallProgress,
          fileIndex: i,
          fileCount: specs.length,
          pauseReason: "network",
          messageBn: `সংযোগ বিচ্ছিন্ন — চালিয়ে যান। (${msg.slice(0, 80)})`,
        });
        return;
      }

      if (job.abort) throw new Error("cancelled");
      if (job.paused) {
        // pauseDownload set this; wait for resumeDownload to restart loop
        return;
      }

      if (!result?.uri || (result.status && result.status >= 400)) {
        await FileSystem.deleteAsync(dest, { idempotent: true }).catch(
          () => undefined,
        );
        await clearPause(entry.id);
        throw new Error(`download-failed:${result?.status ?? "none"}`);
      }

      const ok = await fileLooksInstalled(dest, spec.minBytes);
      if (!ok) {
        await FileSystem.deleteAsync(dest, { idempotent: true }).catch(
          () => undefined,
        );
        await clearPause(entry.id);
        throw new Error("download-incomplete");
      }

      await clearPause(entry.id);
      overallProgress = (i + 1) / specs.length;
      emit({
        modelId: entry.id,
        phase: "downloading",
        progress: Math.min(0.99, overallProgress),
        fileIndex: i + 1,
        fileCount: specs.length,
        messageBn: "যাচাই করা হচ্ছে…",
      });
    }

    emit({
      modelId: entry.id,
      phase: "verifying",
      progress: 0.99,
      fileIndex: specs.length,
      fileCount: specs.length,
      messageBn: "যাচাই করা হচ্ছে…",
    });

    const installed = await isInstalled(entry);
    if (!installed) {
      throw new Error("verify-failed");
    }

    await clearPause(entry.id);
    emit({
      modelId: entry.id,
      phase: "done",
      progress: 1,
      fileIndex: specs.length,
      fileCount: specs.length,
      messageBn: "ডাউনলোড সম্পন্ন",
    });
  } catch (err) {
    if (job.abort) {
      emit({
        modelId: entry.id,
        phase: "idle",
        progress: 0,
        fileIndex: 0,
        fileCount: specs.length,
        messageBn: "বাতিল করা হয়েছে",
      });
    } else {
      const code = err instanceof Error ? err.message : "error";
      emit({
        modelId: entry.id,
        phase: "error",
        progress: overallProgress,
        fileIndex: job.fileIndex,
        fileCount: specs.length,
        messageBn:
          code === "verify-failed" || code === "download-incomplete"
            ? "ফাইল অসম্পূর্ণ। আবার চেষ্টা করুন।"
            : "ডাউনলোড ব্যর্থ। ওয়াই‑ফাই চেক করে চালিয়ে যান।",
      });
    }
    throw err;
  } finally {
    const current = jobs.get(entry.id);
    if (current === job && !job.paused) {
      jobs.delete(entry.id);
    }
  }
}

/** Start a download (or resume if paused). Resolves when done; rejects on error/cancel. */
export async function downloadModel(
  entry: ModelCatalogEntry,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  const unsub = onProgress
    ? subscribeDownloads((s) => {
        if (s.modelId === entry.id) onProgress(s.progress);
      })
    : null;

  try {
    await runDownload(entry);
    const final = snapshots.get(entry.id);
    if (final?.phase === "paused") {
      // Wait until user resumes and finishes, or errors out
      await new Promise<void>((resolve, reject) => {
        const off = subscribeDownloads((s) => {
          if (s.modelId !== entry.id) return;
          if (s.phase === "done") {
            off();
            resolve();
          } else if (s.phase === "error" || s.phase === "idle") {
            off();
            reject(new Error(s.messageBn ?? "download-stopped"));
          }
        });
      });
      return;
    }
    if (final?.phase !== "done") {
      throw new Error(final?.messageBn ?? "download-failed");
    }
  } finally {
    unsub?.();
  }
}

/** Fire-and-forget start used by the Models UI. */
export function startModelDownload(entry: ModelCatalogEntry): void {
  void runDownload(entry).catch(() => undefined);
}

export async function pauseDownload(
  modelId: string,
  reason: "user" | "network" = "user",
): Promise<void> {
  const job = jobs.get(modelId);
  if (!job || !job.resumable) {
    const snap = snapshots.get(modelId);
    if (snap && snap.phase === "downloading") {
      emit({
        ...snap,
        phase: "paused",
        pauseReason: reason,
        messageBn: reason === "user" ? "থামানো আছে" : "সংযোগ নেই — থামানো",
      });
    }
    return;
  }
  job.paused = true;
  job.pauseReason = reason;
  const progress = snapshots.get(modelId)?.progress ?? 0;
  try {
    const pause = await job.resumable.pauseAsync();
    await savePause({
      modelId,
      fileIndex: job.fileIndex,
      progress,
      url: pause.url,
      fileUri: pause.fileUri,
      resumeData: pause.resumeData,
      options: pause.options,
    });
  } catch {
    await persistActivePause(job, progress);
  }
  job.resumable = null;
  emit({
    modelId,
    phase: "paused",
    progress,
    fileIndex: job.fileIndex,
    fileCount: fileSpecs(job.entry).length,
    pauseReason: reason,
    messageBn:
      reason === "user"
        ? "থামানো আছে — চালিয়ে যেতে পারেন"
        : "সংযোগ নেই — ফিরলে নিজে চালু হবে",
  });
}

export async function resumeDownload(modelId: string): Promise<void> {
  const entry =
    jobs.get(modelId)?.entry ??
    MODEL_CATALOG.find((e) => e.id === modelId);
  if (!entry) return;

  const job = jobs.get(modelId);
  if (job) {
    job.paused = false;
    job.abort = false;
  }
  // Fire and forget runner; UI listens via subscribeDownloads
  void runDownload(entry).catch(() => undefined);
}

export async function cancelDownload(modelId: string): Promise<void> {
  const job = jobs.get(modelId);
  if (job) {
    job.abort = true;
    job.paused = false;
    try {
      await job.resumable?.cancelAsync();
    } catch {
      // ignore
    }
    jobs.delete(modelId);
  }
  await clearPause(modelId);
  const entry = MODEL_CATALOG.find((e) => e.id === modelId);
  if (entry) {
    // Keep completed files; only remove incomplete current targets
    // Full cancel: wipe model dir so user starts clean
    await FileSystem.deleteAsync(localDir(entry), { idempotent: true }).catch(
      () => undefined,
    );
  }
  emit({
    modelId,
    phase: "idle",
    progress: 0,
    fileIndex: 0,
    fileCount: entry ? fileSpecs(entry).length : 1,
    messageBn: "বাতিল করা হয়েছে",
  });
}

/** Restore paused jobs into UI state after app launch. */
export async function hydratePausedDownloads(): Promise<void> {
  for (const entry of MODEL_CATALOG) {
    const pause = await loadPause(entry.id);
    if (!pause) continue;
    if (await isInstalled(entry)) {
      await clearPause(entry.id);
      continue;
    }
    emit({
      modelId: entry.id,
      phase: "paused",
      progress: pause.progress || 0,
      fileIndex: pause.fileIndex,
      fileCount: fileSpecs(entry).length,
      pauseReason: "user",
      messageBn: "আগের ডাউনলোড থামানো আছে — চালিয়ে যান",
    });
  }
}

export async function deleteModel(entry: ModelCatalogEntry): Promise<void> {
  await cancelDownload(entry.id).catch(() => undefined);
  await FileSystem.deleteAsync(localDir(entry), { idempotent: true });
  snapshots.delete(entry.id);
}

export async function hasInstalledLlm(): Promise<boolean> {
  const llms = (await listInstalled()).filter((e) => e.kind === "llm");
  return llms.length > 0;
}

export async function storageUsedMb(): Promise<number> {
  const installed = await listInstalled();
  return installed.reduce((sum, e) => sum + e.sizeMb, 0);
}

/**
 * Download / list / delete offline models under documentDirectory/models/.
 * Supports single-file (GGUF) and multi-file (STT/TTS ONNX) catalog entries.
 */
import * as FileSystem from "expo-file-system/legacy";
import {
  MODEL_CATALOG,
  type ModelCatalogEntry,
  defaultDownloadUrl,
} from "@/lib/modelManager/catalog";

const MODELS_DIR = `${FileSystem.documentDirectory ?? ""}models/`;

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
  if (entry.files?.length) {
    const flags = await Promise.all(
      entry.files.map(async (f) => {
        const info = await FileSystem.getInfoAsync(
          `${localDir(entry)}${f.relativePath}`,
        );
        if (!info.exists) return false;
        // Skip tiny error pages; mmproj/GGUF are hundreds of MB
        if ((info.size ?? 0) < 1024 * 1024) return false;
        return true;
      }),
    );
    return flags.every(Boolean);
  }
  const info = await FileSystem.getInfoAsync(localPath(entry));
  if (!info.exists) return false;
  // An error page saved as .gguf is a few KB — treat anything far below the
  // expected size as not installed.
  const minBytes = entry.sizeMb * 1024 * 1024 * 0.5;
  return (info.size ?? 0) >= minBytes;
}

export async function listInstalled(): Promise<ModelCatalogEntry[]> {
  const flags = await Promise.all(MODEL_CATALOG.map(isInstalled));
  return MODEL_CATALOG.filter((_, i) => flags[i]);
}

async function downloadOne(
  url: string,
  dest: string,
  onProgress: (fraction: number) => void,
): Promise<void> {
  const parent = dest.replace(/[^/]+$/, "");
  await ensureDir(parent);
  const resumable = FileSystem.createDownloadResumable(
    url,
    dest,
    {},
    (p) => {
      const total = p.totalBytesExpectedToWrite;
      if (!total) {
        onProgress(0);
        return;
      }
      onProgress(p.totalBytesWritten / total);
    },
  );
  const result = await resumable.downloadAsync();
  if (!result?.uri || (result.status && result.status >= 400)) {
    await FileSystem.deleteAsync(dest, { idempotent: true }).catch(
      () => undefined,
    );
    throw new Error(`download-failed:${result?.status ?? "none"}`);
  }
}

export async function downloadModel(
  entry: ModelCatalogEntry,
  onProgress: (fraction: number) => void,
): Promise<void> {
  if (!FileSystem.documentDirectory) {
    throw new Error("documentDirectory unavailable");
  }
  await ensureDir();
  await ensureDir(localDir(entry));

  if (entry.files?.length) {
    const n = entry.files.length;
    let completed = 0;
    for (const f of entry.files) {
      const dest = `${localDir(entry)}${f.relativePath}`;
      await downloadOne(f.url, dest, (frac) => {
        onProgress((completed + frac) / n);
      });
      completed += 1;
      onProgress(completed / n);
    }
    return;
  }

  await downloadOne(defaultDownloadUrl(entry), localPath(entry), onProgress);
  onProgress(1);
}

export async function deleteModel(entry: ModelCatalogEntry): Promise<void> {
  await FileSystem.deleteAsync(localDir(entry), { idempotent: true });
}

export async function storageUsedMb(): Promise<number> {
  const installed = await listInstalled();
  return installed.reduce((sum, e) => sum + e.sizeMb, 0);
}

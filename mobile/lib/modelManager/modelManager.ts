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

export async function isInstalled(entry: ModelCatalogEntry): Promise<boolean> {
  if (!FileSystem.documentDirectory) return false;
  if (entry.files?.length) {
    const flags = await Promise.all(
      entry.files.map(async (f) => {
        const info = await FileSystem.getInfoAsync(
          `${localDir(entry)}${f.relativePath}`,
        );
        return info.exists;
      }),
    );
    return flags.every(Boolean);
  }
  const info = await FileSystem.getInfoAsync(localPath(entry));
  return info.exists;
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
  if (!result?.uri) throw new Error(`download-failed:${dest}`);
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

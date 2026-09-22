/**
 * Download / list / delete offline models under documentDirectory/models/.
 * Uses expo-file-system legacy resumable downloads (Expo SDK 54).
 */
import * as FileSystem from "expo-file-system/legacy";
import {
  MODEL_CATALOG,
  type ModelCatalogEntry,
  defaultDownloadUrl,
} from "@/lib/modelManager/catalog";

const MODELS_DIR = `${FileSystem.documentDirectory ?? ""}models/`;

async function ensureDir() {
  const info = await FileSystem.getInfoAsync(MODELS_DIR);
  if (!info.exists) {
    await FileSystem.makeDirectoryAsync(MODELS_DIR, { intermediates: true });
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
  const info = await FileSystem.getInfoAsync(localPath(entry));
  return info.exists;
}

export async function listInstalled(): Promise<ModelCatalogEntry[]> {
  const flags = await Promise.all(MODEL_CATALOG.map(isInstalled));
  return MODEL_CATALOG.filter((_, i) => flags[i]);
}

export async function downloadModel(
  entry: ModelCatalogEntry,
  onProgress: (fraction: number) => void,
): Promise<void> {
  if (!FileSystem.documentDirectory) {
    throw new Error("documentDirectory unavailable");
  }
  await ensureDir();
  const dir = localDir(entry);
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(
    () => undefined,
  );

  const resumable = FileSystem.createDownloadResumable(
    defaultDownloadUrl(entry),
    localPath(entry),
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
  if (!result?.uri) {
    throw new Error(`download-failed:${entry.id}`);
  }
  onProgress(1);
}

export async function deleteModel(entry: ModelCatalogEntry): Promise<void> {
  await FileSystem.deleteAsync(localDir(entry), { idempotent: true });
}

export async function storageUsedMb(): Promise<number> {
  const installed = await listInstalled();
  return installed.reduce((sum, e) => sum + e.sizeMb, 0);
}

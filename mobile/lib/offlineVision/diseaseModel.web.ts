import type { DiagnosisResult } from "@/types/diagnosis";

/** TFLite is native-only — web always reports unavailable. */
export async function isDiseaseModelAvailable(): Promise<boolean> {
  return false;
}

export async function loadDiseaseModel(): Promise<boolean> {
  return false;
}

export async function classifyLeaf(
  _imageUri: string,
): Promise<DiagnosisResult | null> {
  return null;
}

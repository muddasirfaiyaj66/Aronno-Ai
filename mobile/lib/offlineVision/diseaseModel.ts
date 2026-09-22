/**
 * TFLite crop-disease classifier (react-native-fast-tflite).
 * Sprint 3: load crop_disease_int8.tflite + map through knowledge base → DiagnosisResult.
 * Offline scan label + KB facts should also be passed into chatLoop / retrieveContextForLabel
 * so the on-device LLM can explain the result in Bangla.
 */
import type { DiagnosisResult } from "@/types/diagnosis";

export async function loadDiseaseModel(): Promise<void> {
  // TODO(Sprint 3): loadTensorflowModel(require(...))
}

export async function classifyLeaf(
  _imageUri: string,
): Promise<DiagnosisResult | null> {
  // TODO(Sprint 3): resize 224x224 → run → map class → DiagnosisResult
  return null;
}

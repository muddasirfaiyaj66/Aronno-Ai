import type { ToolResult } from "@/types/tools";

/** TFLite is native-only — web always reports unavailable. */
export async function isToolModelAvailable(): Promise<boolean> {
  return false;
}

export async function loadToolModel(): Promise<boolean> {
  return false;
}

export async function detectTool(_imageUri: string): Promise<ToolResult | null> {
  return null;
}

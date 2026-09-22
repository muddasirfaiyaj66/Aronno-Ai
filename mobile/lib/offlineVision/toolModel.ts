/**
 * TFLite YOLOv8n tool detector.
 * Sprint 4: decode boxes → top class → ToolResult (listings omitted offline).
 */
import type { ToolResult } from "@/types/tools";

export async function loadToolModel(): Promise<void> {
  // TODO(Sprint 4)
}

export async function detectTool(_imageUri: string): Promise<ToolResult | null> {
  // TODO(Sprint 4)
  return null;
}

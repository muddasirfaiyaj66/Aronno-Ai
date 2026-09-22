/**
 * Bidirectional sync: upload pending local rows, download server history/chat.
 */
import { fetchIsOnline } from "@/hooks/useIsOnline";
import { uploadImageToCloudinary } from "@/services/cloudinary";
import { api } from "@/services/api";
import { store } from "@/store";
import {
  countPendingUploads,
  listPendingChat,
  listPendingDiagnoses,
  listPendingTools,
  markChatSynced,
  markDiagnosisFailed,
  markDiagnosisSynced,
  markToolSynced,
  setSyncMeta,
  upsertChatFromServer,
  upsertDiagnosesFromServer,
} from "@/lib/offlineDb/queries";
import type { DiseaseHistoryEntry } from "@/types/history";
import { logMetric } from "@/lib/offline/metrics";

let syncing = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let listeners = new Set<(s: { syncing: boolean; pending: number }) => void>();

export function subscribeSyncStatus(
  fn: (s: { syncing: boolean; pending: number }) => void,
): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

async function emitStatus() {
  const pending = await countPendingUploads().catch(() => 0);
  const payload = { syncing, pending };
  listeners.forEach((fn) => fn(payload));
}

export function requestSyncSoon(ms = 2500) {
  if (debounceTimer) clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    void runSync();
  }, ms);
}

export async function runSync(): Promise<{ ok: boolean; message?: string }> {
  if (syncing) return { ok: true, message: "busy" };
  const online = await fetchIsOnline();
  if (!online) return { ok: false, message: "offline" };

  syncing = true;
  await emitStatus();
  logMetric("sync.start");

  try {
    const diagnoses = await listPendingDiagnoses();
    const tools = await listPendingTools();
    const chats = await listPendingChat();

    const diagnosisPayload = [];
    for (const d of diagnoses) {
      let imageObjectKey: string | undefined;
      if (d.imageUri && (d.imageUri.startsWith("file:") || d.imageUri.startsWith("content:"))) {
        try {
          imageObjectKey = await uploadImageToCloudinary(d.imageUri);
        } catch {
          await markDiagnosisFailed(d.localId);
          continue;
        }
      } else if (d.imageUri.startsWith("http")) {
        imageObjectKey = d.imageUri;
      }
      diagnosisPayload.push({
        clientLocalId: d.localId,
        labelId: d.labelId,
        diseaseNameBn: d.diseaseNameBn,
        diseaseNameEn: d.diseaseNameEn,
        confidence: d.confidence,
        severity: d.severity,
        verifiedBn: d.verifiedBn,
        source: d.source.startsWith("offline") ? d.source : "offline_photo",
        imageObjectKey,
      });
    }

    const toolPayload = tools.map((t) => ({
      clientLocalId: t.localId,
      labelId: t.labelId,
      toolNameBn: t.toolNameBn,
      toolNameEn: t.toolNameEn,
      reasonBn: t.reasonBn,
      verifiedBn: t.verifiedBn,
      imageObjectKey: t.imageUri.startsWith("http") ? t.imageUri : undefined,
    }));

    const chatPayload = chats.map((c) => ({
      clientLocalId: c.localId,
      role: c.role,
      textBn: c.textBn,
      createdAt: c.createdAt,
    }));

    if (diagnosisPayload.length || toolPayload.length || chatPayload.length) {
      const result = await store
        .dispatch(
          api.endpoints.syncOffline.initiate({
            diagnoses: diagnosisPayload,
            tools: toolPayload,
            chatTurns: chatPayload,
          }),
        )
        .unwrap();

      for (const m of result.diagnoses ?? []) {
        await markDiagnosisSynced(m.clientLocalId, m.serverId);
      }
      for (const m of result.tools ?? []) {
        await markToolSynced(m.clientLocalId, m.serverId);
      }
      for (const m of result.chatTurns ?? []) {
        await markChatSynced(m.clientLocalId, m.serverId);
      }
    }

    // Pull server disease history into local DB
    const history = await store
      .dispatch(api.endpoints.getHistory.initiate({ kind: "disease" }))
      .unwrap();
    const diseaseEntries = (history as DiseaseHistoryEntry[]).filter(
      (e) => e.kind === "disease",
    );
    await upsertDiagnosesFromServer(diseaseEntries);

    try {
      const chatPull = await store
        .dispatch(
          api.endpoints.syncPullChat.initiate({
            limit: 50,
          }),
        )
        .unwrap();
      await upsertChatFromServer(chatPull.items ?? []);
      if (chatPull.nextCursor) {
        await setSyncMeta("chat_cursor", chatPull.nextCursor);
      }
    } catch {
      // endpoint may be unavailable on older servers
    }

    await setSyncMeta("last_sync_at", new Date().toISOString());
    logMetric("sync.ok");
    return { ok: true };
  } catch (err) {
    logMetric(
      "sync.fail",
      undefined,
      err instanceof Error ? err.message : "error",
    );
    return { ok: false, message: err instanceof Error ? err.message : "error" };
  } finally {
    syncing = false;
    await emitStatus();
  }
}

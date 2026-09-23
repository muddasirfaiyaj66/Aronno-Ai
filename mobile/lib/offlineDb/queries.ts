import type { DiseaseHistoryEntry, HistoryEntry } from "@/types/history";
import { getOfflineDb, newLocalId, nowIso } from "@/lib/offlineDb/db";
import type {
  LocalChatTurnRow,
  LocalDiagnosisRow,
  LocalToolRow,
  SyncStatus,
} from "@/lib/offlineDb/schema";

function dateBn(iso: string): string {
  try {
    return new Intl.DateTimeFormat("bn-BD", {
      day: "numeric",
      month: "long",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

function mapDiag(r: Record<string, unknown>): LocalDiagnosisRow {
  return {
    localId: String(r.local_id),
    serverId: r.server_id ? String(r.server_id) : null,
    labelId: String(r.label_id),
    diseaseNameBn: String(r.disease_name_bn),
    diseaseNameEn: String(r.disease_name_en),
    confidence: Number(r.confidence),
    severity: String(r.severity),
    imageUri: String(r.image_uri ?? ""),
    verifiedBn: r.verified_bn ? String(r.verified_bn) : null,
    source: String(r.source) as LocalDiagnosisRow["source"],
    syncStatus: String(r.sync_status) as SyncStatus,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function mapTool(r: Record<string, unknown>): LocalToolRow {
  return {
    localId: String(r.local_id),
    serverId: r.server_id ? String(r.server_id) : null,
    labelId: String(r.label_id),
    toolNameBn: String(r.tool_name_bn),
    toolNameEn: String(r.tool_name_en),
    reasonBn: String(r.reason_bn),
    imageUri: String(r.image_uri ?? ""),
    verifiedBn: r.verified_bn ? String(r.verified_bn) : null,
    syncStatus: String(r.sync_status) as SyncStatus,
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

function mapChat(r: Record<string, unknown>): LocalChatTurnRow {
  return {
    localId: String(r.local_id),
    serverId: r.server_id ? String(r.server_id) : null,
    role: String(r.role) as LocalChatTurnRow["role"],
    textBn: String(r.text_bn),
    extraContextJson: r.extra_context_json
      ? String(r.extra_context_json)
      : null,
    syncStatus: String(r.sync_status) as SyncStatus,
    createdAt: String(r.created_at),
  };
}

export async function insertDiagnosis(
  input: Omit<
    LocalDiagnosisRow,
    "localId" | "serverId" | "syncStatus" | "createdAt" | "updatedAt"
  > & {
    localId?: string;
    serverId?: string | null;
    syncStatus?: SyncStatus;
  },
): Promise<LocalDiagnosisRow> {
  const db = await getOfflineDb();
  const localId = input.localId ?? newLocalId("diag");
  const ts = nowIso();
  const syncStatus = input.syncStatus ?? "pending";
  const serverId =
    input.serverId ?? (syncStatus === "synced" ? localId : null);
  await db.runAsync(
    `INSERT OR REPLACE INTO local_diagnoses (
      local_id, server_id, label_id, disease_name_bn, disease_name_en,
      confidence, severity, image_uri, verified_bn, source, sync_status,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      localId,
      serverId,
      input.labelId,
      input.diseaseNameBn,
      input.diseaseNameEn,
      input.confidence,
      input.severity,
      input.imageUri,
      input.verifiedBn,
      input.source,
      syncStatus,
      ts,
      ts,
    ],
  );
  return {
    localId,
    serverId,
    labelId: input.labelId,
    diseaseNameBn: input.diseaseNameBn,
    diseaseNameEn: input.diseaseNameEn,
    confidence: input.confidence,
    severity: input.severity,
    imageUri: input.imageUri,
    verifiedBn: input.verifiedBn,
    source: input.source,
    syncStatus,
    createdAt: ts,
    updatedAt: ts,
  };
}

export async function updateDiagnosisVerified(
  localId: string,
  verifiedBn: string,
): Promise<void> {
  const db = await getOfflineDb();
  await db.runAsync(
    `UPDATE local_diagnoses SET verified_bn = ?, updated_at = ? WHERE local_id = ?`,
    [verifiedBn, nowIso(), localId],
  );
}

export async function insertTool(
  input: Omit<
    LocalToolRow,
    "localId" | "serverId" | "syncStatus" | "createdAt" | "updatedAt"
  > & { localId?: string; syncStatus?: SyncStatus },
): Promise<LocalToolRow> {
  const db = await getOfflineDb();
  const localId = input.localId ?? newLocalId("tool");
  const ts = nowIso();
  const syncStatus = input.syncStatus ?? "pending";
  await db.runAsync(
    `INSERT INTO local_tools (
      local_id, server_id, label_id, tool_name_bn, tool_name_en, reason_bn,
      image_uri, verified_bn, sync_status, created_at, updated_at
    ) VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      localId,
      input.labelId,
      input.toolNameBn,
      input.toolNameEn,
      input.reasonBn,
      input.imageUri,
      input.verifiedBn,
      syncStatus,
      ts,
      ts,
    ],
  );
  return {
    localId,
    serverId: null,
    labelId: input.labelId,
    toolNameBn: input.toolNameBn,
    toolNameEn: input.toolNameEn,
    reasonBn: input.reasonBn,
    imageUri: input.imageUri,
    verifiedBn: input.verifiedBn,
    syncStatus,
    createdAt: ts,
    updatedAt: ts,
  };
}

export async function insertChatTurn(
  role: LocalChatTurnRow["role"],
  textBn: string,
  extraContext?: string[],
): Promise<LocalChatTurnRow> {
  const db = await getOfflineDb();
  const localId = newLocalId("chat");
  const ts = nowIso();
  const extra =
    extraContext && extraContext.length
      ? JSON.stringify(extraContext)
      : null;
  await db.runAsync(
    `INSERT INTO chat_turns (
      local_id, server_id, role, text_bn, extra_context_json, sync_status, created_at
    ) VALUES (?, NULL, ?, ?, ?, 'pending', ?)`,
    [localId, role, textBn, extra, ts],
  );
  return {
    localId,
    serverId: null,
    role,
    textBn,
    extraContextJson: extra,
    syncStatus: "pending",
    createdAt: ts,
  };
}

export async function listChatTurns(limit = 80): Promise<LocalChatTurnRow[]> {
  const db = await getOfflineDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM chat_turns ORDER BY created_at ASC LIMIT ?`,
    [limit],
  );
  return rows.map(mapChat);
}

/**
 * Last few turns for follow-up grounding (e.g. user says «হ্যাঁ»).
 * Kept short so small models don't copy the whole chat.
 */
export async function recentChatForPrompt(limit = 4): Promise<string[]> {
  const db = await getOfflineDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT role, text_bn FROM chat_turns ORDER BY created_at DESC LIMIT ?`,
    [limit],
  );
  return rows
    .reverse()
    .map((r) => {
      const role = String(r.role) === "user" ? "ব্যবহারকারী" : "আরণ্য";
      const text = String(r.text_bn ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120);
      if (!text) return null;
      return `${role}: ${text}`;
    })
    .filter((s): s is string => !!s);
}

export async function listLocalHistory(): Promise<HistoryEntry[]> {
  const db = await getOfflineDb();
  const diags = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM local_diagnoses ORDER BY created_at DESC LIMIT 100`,
  );
  const out: DiseaseHistoryEntry[] = diags.map((r: Record<string, unknown>) => {
    const d = mapDiag(r);
    return {
      // Always navigate with localId so offline detail lookup works.
      id: d.localId,
      sourceId: d.serverId ?? undefined,
      kind: "disease",
      date: d.createdAt.slice(0, 10),
      dateBn: dateBn(d.createdAt),
      cropNameBn: "ফসল",
      diseaseNameBn: d.diseaseNameBn,
      diseaseNameEn: d.diseaseNameEn,
      severity: (d.severity === "low" || d.severity === "high"
        ? d.severity
        : "medium") as DiseaseHistoryEntry["severity"],
      confidence: d.confidence,
      imageUrl: d.imageUri,
    };
  });
  return out;
}

/** Lookup by local_id or server_id (history can pass either). */
export async function getDiagnosisByAnyId(
  id: string,
): Promise<LocalDiagnosisRow | null> {
  if (!id) return null;
  const db = await getOfflineDb();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM local_diagnoses WHERE local_id = ? OR server_id = ? LIMIT 1`,
    [id, id],
  );
  return row ? mapDiag(row) : null;
}

export async function countPendingUploads(): Promise<number> {
  const db = await getOfflineDb();
  const d = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM local_diagnoses WHERE sync_status = 'pending'`,
  );
  const t = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM local_tools WHERE sync_status = 'pending'`,
  );
  const c = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM chat_turns WHERE sync_status = 'pending'`,
  );
  return (d?.c ?? 0) + (t?.c ?? 0) + (c?.c ?? 0);
}

export async function listPendingDiagnoses(): Promise<LocalDiagnosisRow[]> {
  const db = await getOfflineDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM local_diagnoses WHERE sync_status = 'pending' ORDER BY created_at ASC`,
  );
  return rows.map(mapDiag);
}

export async function listPendingTools(): Promise<LocalToolRow[]> {
  const db = await getOfflineDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM local_tools WHERE sync_status = 'pending' ORDER BY created_at ASC`,
  );
  return rows.map(mapTool);
}

export async function listPendingChat(): Promise<LocalChatTurnRow[]> {
  const db = await getOfflineDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM chat_turns WHERE sync_status = 'pending' ORDER BY created_at ASC LIMIT 200`,
  );
  return rows.map(mapChat);
}

export async function markDiagnosisSynced(
  localId: string,
  serverId: string,
): Promise<void> {
  const db = await getOfflineDb();
  await db.runAsync(
    `UPDATE local_diagnoses SET server_id = ?, sync_status = 'synced', updated_at = ? WHERE local_id = ?`,
    [serverId, nowIso(), localId],
  );
}

export async function markToolSynced(
  localId: string,
  serverId: string,
): Promise<void> {
  const db = await getOfflineDb();
  await db.runAsync(
    `UPDATE local_tools SET server_id = ?, sync_status = 'synced', updated_at = ? WHERE local_id = ?`,
    [serverId, nowIso(), localId],
  );
}

export async function markChatSynced(
  localId: string,
  serverId: string,
): Promise<void> {
  const db = await getOfflineDb();
  await db.runAsync(
    `UPDATE chat_turns SET server_id = ?, sync_status = 'synced' WHERE local_id = ?`,
    [serverId, localId],
  );
}

export async function markDiagnosisFailed(localId: string): Promise<void> {
  const db = await getOfflineDb();
  await db.runAsync(
    `UPDATE local_diagnoses SET sync_status = 'failed', updated_at = ? WHERE local_id = ?`,
    [nowIso(), localId],
  );
}

export async function getSyncMeta(key: string): Promise<string | null> {
  const db = await getOfflineDb();
  const row = await db.getFirstAsync<{ value: string }>(
    `SELECT value FROM sync_meta WHERE key = ?`,
    [key],
  );
  return row?.value ?? null;
}

export async function setSyncMeta(key: string, value: string): Promise<void> {
  const db = await getOfflineDb();
  await db.runAsync(
    `INSERT INTO sync_meta (key, value) VALUES (?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value],
  );
}

/** Upsert server disease history into local DB (already synced). */
export async function upsertDiagnosesFromServer(
  entries: DiseaseHistoryEntry[],
): Promise<void> {
  const db = await getOfflineDb();
  const ts = nowIso();
  for (const e of entries) {
    if (e.kind !== "disease") continue;
    const serverId = e.sourceId ?? e.id;
    const existing = await db.getFirstAsync<{ local_id: string }>(
      `SELECT local_id FROM local_diagnoses WHERE server_id = ? OR local_id = ?`,
      [serverId, serverId],
    );
    if (existing) continue;
    const localId = newLocalId("srv");
    await db.runAsync(
      `INSERT INTO local_diagnoses (
        local_id, server_id, label_id, disease_name_bn, disease_name_en,
        confidence, severity, image_uri, verified_bn, source, sync_status,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 'photo', 'synced', ?, ?)`,
      [
        localId,
        serverId,
        e.diseaseNameEn || e.diseaseNameBn,
        e.diseaseNameBn,
        e.diseaseNameEn,
        e.confidence,
        e.severity,
        e.imageUrl,
        e.date ? `${e.date}T00:00:00.000Z` : ts,
        ts,
      ],
    );
  }
}

export async function upsertChatFromServer(
  turns: {
    id: string;
    role: "user" | "assistant";
    textBn: string;
    createdAt: string;
    clientLocalId?: string | null;
  }[],
): Promise<void> {
  const db = await getOfflineDb();
  for (const t of turns) {
    if (t.clientLocalId) {
      const byLocal = await db.getFirstAsync<{ local_id: string }>(
        `SELECT local_id FROM chat_turns WHERE local_id = ?`,
        [t.clientLocalId],
      );
      if (byLocal) {
        await db.runAsync(
          `UPDATE chat_turns SET server_id = ?, sync_status = 'synced' WHERE local_id = ?`,
          [t.id, t.clientLocalId],
        );
        continue;
      }
    }
    const byServer = await db.getFirstAsync<{ local_id: string }>(
      `SELECT local_id FROM chat_turns WHERE server_id = ?`,
      [t.id],
    );
    if (byServer) continue;
    await db.runAsync(
      `INSERT INTO chat_turns (
        local_id, server_id, role, text_bn, extra_context_json, sync_status, created_at
      ) VALUES (?, ?, ?, ?, NULL, 'synced', ?)`,
      [t.clientLocalId ?? newLocalId("schat"), t.id, t.role, t.textBn, t.createdAt],
    );
  }
}

export async function clearChatTurns(): Promise<void> {
  const db = await getOfflineDb();
  await db.runAsync(`DELETE FROM chat_turns`);
}

export async function recentDiagnoses(limit = 3): Promise<
  { diseaseNameBn: string; diseaseNameEn: string; labelId: string; confidence: number; createdAt: string }[]
> {
  const db = await getOfflineDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT label_id, disease_name_bn, disease_name_en, confidence, created_at
     FROM local_diagnoses ORDER BY created_at DESC LIMIT ?`,
    [limit],
  );
  return rows.map((r) => ({
    labelId: String(r.label_id ?? ""),
    diseaseNameBn: String(r.disease_name_bn ?? ""),
    diseaseNameEn: String(r.disease_name_en ?? ""),
    confidence: Number(r.confidence ?? 0),
    createdAt: String(r.created_at ?? ""),
  }));
}

/**
 * Recent scans for Gemma grounding. Past chat turns are deliberately left out:
 * small on-device models copy them verbatim instead of answering.
 */
export async function recentScansForPrompt(): Promise<string[]> {
  const db = await getOfflineDb();
  const diags = await db.getAllAsync<Record<string, unknown>>(
    `SELECT disease_name_bn, disease_name_en, confidence, verified_bn
     FROM local_diagnoses ORDER BY created_at DESC LIMIT 2`,
  );
  return diags.reverse().map((d) => {
    const note = d.verified_bn ? ` — ${String(d.verified_bn)}` : "";
    return `সাম্প্রতিক স্ক্যান: ${String(d.disease_name_bn)} (${String(d.disease_name_en)}), আত্মবিশ্বাস ${Number(d.confidence)}%${note}`;
  });
}

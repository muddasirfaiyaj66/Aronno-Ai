import type { DiseaseHistoryEntry, HistoryEntry } from "@/types/history";
import { getOfflineDb, newLocalId, nowIso } from "@/lib/offlineDb/db";
import type {
  LocalChatSessionRow,
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
    conversationId: String(r.conversation_id ?? ""),
    role: String(r.role) as LocalChatTurnRow["role"],
    textBn: String(r.text_bn),
    extraContextJson: r.extra_context_json
      ? String(r.extra_context_json)
      : null,
    syncStatus: String(r.sync_status) as SyncStatus,
    createdAt: String(r.created_at),
  };
}

function mapSession(r: Record<string, unknown>): LocalChatSessionRow {
  return {
    localId: String(r.local_id),
    titleBn: String(r.title_bn),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  };
}

export async function createChatSession(
  titleBn = "নতুন আলোচনা",
): Promise<string> {
  const db = await getOfflineDb();
  const localId = newLocalId("sess");
  const ts = nowIso();
  await db.runAsync(
    `INSERT INTO chat_sessions (local_id, title_bn, created_at, updated_at) VALUES (?, ?, ?, ?)`,
    [localId, titleBn, ts, ts],
  );
  return localId;
}

/** Prefer most recent session; otherwise create one. */
export async function ensureActiveChatSession(): Promise<string> {
  const db = await getOfflineDb();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM chat_sessions ORDER BY updated_at DESC LIMIT 1`,
  );
  if (row) return String(row.local_id);
  return createChatSession();
}

export async function getChatSession(
  id: string,
): Promise<LocalChatSessionRow | null> {
  const db = await getOfflineDb();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT * FROM chat_sessions WHERE local_id = ?`,
    [id],
  );
  return row ? mapSession(row) : null;
}

export async function listChatSessions(
  limit = 40,
): Promise<LocalChatSessionRow[]> {
  const db = await getOfflineDb();
  const rows = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM chat_sessions ORDER BY updated_at DESC LIMIT ?`,
    [limit],
  );
  return rows.map(mapSession);
}

export async function touchChatSession(id: string): Promise<void> {
  const db = await getOfflineDb();
  await db.runAsync(
    `UPDATE chat_sessions SET updated_at = ? WHERE local_id = ?`,
    [nowIso(), id],
  );
}

export async function renameChatSession(
  id: string,
  titleBn: string,
): Promise<void> {
  const db = await getOfflineDb();
  await db.runAsync(
    `UPDATE chat_sessions SET title_bn = ?, updated_at = ? WHERE local_id = ?`,
    [titleBn.trim() || "আলোচনা", nowIso(), id],
  );
}

export async function deleteChatSession(id: string): Promise<void> {
  const db = await getOfflineDb();
  await db.runAsync(`DELETE FROM chat_turns WHERE conversation_id = ?`, [id]);
  await db.runAsync(`DELETE FROM chat_sessions WHERE local_id = ?`, [id]);
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
  conversationId?: string,
): Promise<LocalChatTurnRow> {
  const db = await getOfflineDb();
  const localId = newLocalId("chat");
  const ts = nowIso();
  const extra =
    extraContext && extraContext.length
      ? JSON.stringify(extraContext)
      : null;
  let convId = conversationId ?? "";
  if (!convId) {
    const latest = await db.getFirstAsync<{ local_id: string }>(
      `SELECT local_id FROM chat_sessions ORDER BY updated_at DESC LIMIT 1`,
    );
    convId = latest?.local_id ?? (await createChatSession());
  }
  await db.runAsync(
    `INSERT INTO chat_turns (
      local_id, server_id, conversation_id, role, text_bn, extra_context_json, sync_status, created_at
    ) VALUES (?, NULL, ?, ?, ?, ?, 'pending', ?)`,
    [localId, convId, role, textBn, extra, ts],
  );
  await db.runAsync(
    `UPDATE chat_sessions SET updated_at = ? WHERE local_id = ?`,
    [ts, convId],
  );
  return {
    localId,
    serverId: null,
    conversationId: convId,
    role,
    textBn,
    extraContextJson: extra,
    syncStatus: "pending",
    createdAt: ts,
  };
}

export async function listChatTurns(
  limit = 80,
  conversationId?: string,
): Promise<LocalChatTurnRow[]> {
  const db = await getOfflineDb();
  if (conversationId) {
    const rows = await db.getAllAsync<Record<string, unknown>>(
      `SELECT * FROM chat_turns WHERE conversation_id = ? ORDER BY created_at ASC LIMIT ?`,
      [conversationId, limit],
    );
    return rows.map(mapChat);
  }
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
export async function recentChatForPrompt(
  limit = 4,
  conversationId?: string,
): Promise<string[]> {
  const db = await getOfflineDb();
  const rows = conversationId
    ? await db.getAllAsync<Record<string, unknown>>(
        `SELECT role, text_bn FROM chat_turns WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?`,
        [conversationId, limit],
      )
    : await db.getAllAsync<Record<string, unknown>>(
        `SELECT role, text_bn FROM chat_turns ORDER BY created_at DESC LIMIT ?`,
        [limit],
      );
  return rows
    .reverse()
    .map((r) => {
      const role = String(r.role) === "user" ? "কৃষক" : "আরণ্য";
      const text = String(r.text_bn ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120);
      if (!text) return null;
      return `${role}: ${text}`;
    })
    .filter((s): s is string => !!s);
}

export async function recentChatHistoryTurns(
  limit = 6,
  conversationId?: string,
): Promise<{ role: "user" | "assistant"; text: string }[]> {
  const db = await getOfflineDb();
  const rows = conversationId
    ? await db.getAllAsync<Record<string, unknown>>(
        `SELECT role, text_bn FROM chat_turns WHERE conversation_id = ? ORDER BY created_at DESC LIMIT ?`,
        [conversationId, limit],
      )
    : await db.getAllAsync<Record<string, unknown>>(
        `SELECT role, text_bn FROM chat_turns ORDER BY created_at DESC LIMIT ?`,
        [limit],
      );
  return rows
    .reverse()
    .map((r) => ({
      role: (String(r.role) === "user" ? "user" : "assistant") as
        | "user"
        | "assistant",
      text: String(r.text_bn ?? "")
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 200),
    }))
    .filter((t) => t.text.length > 0);
}

export async function listLocalHistory(): Promise<HistoryEntry[]> {
  const db = await getOfflineDb();
  const hidden = await listHiddenHistoryIds();
  const diags = await db.getAllAsync<Record<string, unknown>>(
    `SELECT * FROM local_diagnoses ORDER BY created_at DESC LIMIT 100`,
  );
  const out: DiseaseHistoryEntry[] = diags
    .map((r: Record<string, unknown>) => {
      const d = mapDiag(r);
      return {
        // Always navigate with localId so offline detail lookup works.
        id: d.localId,
        sourceId: d.serverId ?? undefined,
        kind: "disease" as const,
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
    })
    .filter(
      (e) =>
        !hidden.has(e.id) && !(e.sourceId && hidden.has(e.sourceId)),
    );
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

export async function hideHistoryId(id: string): Promise<void> {
  if (!id) return;
  const db = await getOfflineDb();
  await db.runAsync(
    `INSERT OR IGNORE INTO hidden_history_ids (id, hidden_at) VALUES (?, ?)`,
    [id, nowIso()],
  );
}

export async function hideHistoryIds(ids: string[]): Promise<void> {
  const unique = [...new Set(ids.filter(Boolean))];
  for (const id of unique) await hideHistoryId(id);
}

export async function listHiddenHistoryIds(): Promise<Set<string>> {
  const db = await getOfflineDb();
  const rows = await db.getAllAsync<{ id: string }>(
    `SELECT id FROM hidden_history_ids`,
  );
  return new Set(rows.map((r) => r.id));
}

export async function isHistoryHidden(id: string): Promise<boolean> {
  if (!id) return false;
  const db = await getOfflineDb();
  const row = await db.getFirstAsync<{ id: string }>(
    `SELECT id FROM hidden_history_ids WHERE id = ? LIMIT 1`,
    [id],
  );
  return Boolean(row);
}

/** Delete local disease row and tombstone ids so sync/remote cannot revive it. */
export async function deleteLocalDiagnosis(id: string): Promise<void> {
  if (!id) return;
  const db = await getOfflineDb();
  const row = await db.getFirstAsync<Record<string, unknown>>(
    `SELECT local_id, server_id FROM local_diagnoses WHERE local_id = ? OR server_id = ? LIMIT 1`,
    [id, id],
  );
  const toHide = [id];
  if (row) {
    toHide.push(String(row.local_id));
    if (row.server_id) toHide.push(String(row.server_id));
  }
  await hideHistoryIds(toHide);
  await db.runAsync(
    `DELETE FROM local_diagnoses WHERE local_id = ? OR server_id = ?`,
    [id, id],
  );
}

export async function deleteLocalTool(id: string): Promise<void> {
  if (!id) return;
  const db = await getOfflineDb();
  await db.runAsync(
    `DELETE FROM local_tools WHERE local_id = ? OR server_id = ?`,
    [id, id],
  );
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
  const hidden = await listHiddenHistoryIds();
  const ts = nowIso();
  for (const e of entries) {
    if (e.kind !== "disease") continue;
    const serverId = e.sourceId ?? e.id;
    if (hidden.has(e.id) || hidden.has(serverId) || (e.sourceId && hidden.has(e.sourceId))) {
      continue;
    }
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
    const sess =
      (
        await db.getFirstAsync<{ local_id: string }>(
          `SELECT local_id FROM chat_sessions ORDER BY updated_at DESC LIMIT 1`,
        )
      )?.local_id ?? (await createChatSession("সার্ভারের আলোচনা"));
    await db.runAsync(
      `INSERT INTO chat_turns (
        local_id, server_id, conversation_id, role, text_bn, extra_context_json, sync_status, created_at
      ) VALUES (?, ?, ?, ?, ?, NULL, 'synced', ?)`,
      [
        t.clientLocalId ?? newLocalId("schat"),
        t.id,
        sess,
        t.role,
        t.textBn,
        t.createdAt,
      ],
    );
  }
}

export async function clearChatTurns(conversationId?: string): Promise<void> {
  const db = await getOfflineDb();
  if (conversationId) {
    await db.runAsync(`DELETE FROM chat_turns WHERE conversation_id = ?`, [
      conversationId,
    ]);
    return;
  }
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

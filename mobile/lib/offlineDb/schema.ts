/** Sync status for local rows awaiting / completed cloud upload. */
export type SyncStatus = "pending" | "synced" | "failed";

export type LocalDiagnosisRow = {
  localId: string;
  serverId: string | null;
  labelId: string;
  diseaseNameBn: string;
  diseaseNameEn: string;
  confidence: number;
  severity: string;
  imageUri: string;
  verifiedBn: string | null;
  source: "offline_photo" | "offline_voice" | "photo" | "voice";
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
};

export type LocalToolRow = {
  localId: string;
  serverId: string | null;
  labelId: string;
  toolNameBn: string;
  toolNameEn: string;
  reasonBn: string;
  imageUri: string;
  verifiedBn: string | null;
  syncStatus: SyncStatus;
  createdAt: string;
  updatedAt: string;
};

export type ChatRole = "user" | "assistant";

export type LocalChatTurnRow = {
  localId: string;
  serverId: string | null;
  role: ChatRole;
  textBn: string;
  extraContextJson: string | null;
  syncStatus: SyncStatus;
  createdAt: string;
};

export const SCHEMA_SQL = `
PRAGMA journal_mode = WAL;

CREATE TABLE IF NOT EXISTS local_diagnoses (
  local_id TEXT PRIMARY KEY NOT NULL,
  server_id TEXT,
  label_id TEXT NOT NULL,
  disease_name_bn TEXT NOT NULL,
  disease_name_en TEXT NOT NULL,
  confidence INTEGER NOT NULL,
  severity TEXT NOT NULL,
  image_uri TEXT NOT NULL DEFAULT '',
  verified_bn TEXT,
  source TEXT NOT NULL DEFAULT 'offline_photo',
  sync_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS local_tools (
  local_id TEXT PRIMARY KEY NOT NULL,
  server_id TEXT,
  label_id TEXT NOT NULL,
  tool_name_bn TEXT NOT NULL,
  tool_name_en TEXT NOT NULL,
  reason_bn TEXT NOT NULL,
  image_uri TEXT NOT NULL DEFAULT '',
  verified_bn TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS chat_turns (
  local_id TEXT PRIMARY KEY NOT NULL,
  server_id TEXT,
  role TEXT NOT NULL,
  text_bn TEXT NOT NULL,
  extra_context_json TEXT,
  sync_status TEXT NOT NULL DEFAULT 'pending',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_meta (
  key TEXT PRIMARY KEY NOT NULL,
  value TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_diag_sync ON local_diagnoses(sync_status);
CREATE INDEX IF NOT EXISTS idx_tool_sync ON local_tools(sync_status);
CREATE INDEX IF NOT EXISTS idx_chat_sync ON chat_turns(sync_status);
CREATE INDEX IF NOT EXISTS idx_chat_created ON chat_turns(created_at);
CREATE INDEX IF NOT EXISTS idx_diag_created ON local_diagnoses(created_at);
`;

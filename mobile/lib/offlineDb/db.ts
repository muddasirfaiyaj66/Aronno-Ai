import * as SQLite from "expo-sqlite";
import { SCHEMA_SQL } from "@/lib/offlineDb/schema";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

async function migrateChatSessions(db: SQLite.SQLiteDatabase) {
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS chat_sessions (
      local_id TEXT PRIMARY KEY NOT NULL,
      title_bn TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  const cols = await db.getAllAsync<{ name: string }>(
    `PRAGMA table_info(chat_turns)`,
  );
  const hasConversation = cols.some((c) => c.name === "conversation_id");
  if (!hasConversation) {
    await db.execAsync(
      `ALTER TABLE chat_turns ADD COLUMN conversation_id TEXT NOT NULL DEFAULT ''`,
    );
  }

  const orphan = await db.getFirstAsync<{ c: number }>(
    `SELECT COUNT(*) as c FROM chat_turns WHERE conversation_id = '' OR conversation_id IS NULL`,
  );
  if ((orphan?.c ?? 0) > 0) {
    const ts = new Date().toISOString();
    const sid = `sess_legacy_${Date.now()}`;
    await db.runAsync(
      `INSERT OR IGNORE INTO chat_sessions (local_id, title_bn, created_at, updated_at) VALUES (?, ?, ?, ?)`,
      [sid, "আগের আলোচনা", ts, ts],
    );
    await db.runAsync(
      `UPDATE chat_turns SET conversation_id = ? WHERE conversation_id = '' OR conversation_id IS NULL`,
      [sid],
    );
  }

  await db.execAsync(`
    CREATE INDEX IF NOT EXISTS idx_chat_conversation ON chat_turns(conversation_id);
    CREATE INDEX IF NOT EXISTS idx_sessions_updated ON chat_sessions(updated_at);
  `);
}

export async function getOfflineDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync("aronno_offline.db");
      await db.execAsync(SCHEMA_SQL);
      await migrateChatSessions(db);
      return db;
    })();
  }
  return dbPromise;
}

export async function initOfflineDb(): Promise<void> {
  await getOfflineDb();
}

export function newLocalId(prefix: string): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

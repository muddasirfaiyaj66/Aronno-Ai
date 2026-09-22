import * as SQLite from "expo-sqlite";
import { SCHEMA_SQL } from "@/lib/offlineDb/schema";

let dbPromise: Promise<SQLite.SQLiteDatabase> | null = null;

export async function getOfflineDb(): Promise<SQLite.SQLiteDatabase> {
  if (!dbPromise) {
    dbPromise = (async () => {
      const db = await SQLite.openDatabaseAsync("aronno_offline.db");
      await db.execAsync(SCHEMA_SQL);
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

import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";
let singleton: DatabaseSync;
export function db() {
  if (singleton) return singleton;
  const path = process.env.TRUST_DESK_DB || "data/trust-desk.sqlite";
  mkdirSync(dirname(path), { recursive: true });
  singleton = new DatabaseSync(path);
  singleton.exec(`PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;
    CREATE TABLE IF NOT EXISTS tenants(id TEXT PRIMARY KEY, config TEXT NOT NULL, trust TEXT NOT NULL DEFAULT 'supervised', version INTEGER NOT NULL DEFAULT 0);
    CREATE TABLE IF NOT EXISTS prices(tenant TEXT NOT NULL REFERENCES tenants(id), row_id TEXT NOT NULL, version TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(tenant,row_id));
    CREATE TABLE IF NOT EXISTS events(id TEXT PRIMARY KEY, tenant TEXT NOT NULL REFERENCES tenants(id), channel TEXT NOT NULL, message_id TEXT NOT NULL, thread TEXT NOT NULL, sent_at TEXT NOT NULL, payload TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'queued', attempts INTEGER NOT NULL DEFAULT 0, lease_until INTEGER, token TEXT, available_at INTEGER NOT NULL DEFAULT 0, error TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, UNIQUE(tenant,channel,message_id));
    CREATE TABLE IF NOT EXISTS drafts(id TEXT PRIMARY KEY, event_id TEXT NOT NULL REFERENCES events(id), tenant TEXT NOT NULL REFERENCES tenants(id), body TEXT NOT NULL, pricing TEXT NOT NULL, decision TEXT NOT NULL, reasons TEXT NOT NULL, status TEXT NOT NULL, version INTEGER NOT NULL DEFAULT 0, source TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS outbox(id TEXT PRIMARY KEY, draft_id TEXT NOT NULL UNIQUE REFERENCES drafts(id), tenant TEXT NOT NULL REFERENCES tenants(id), body TEXT NOT NULL, state TEXT NOT NULL DEFAULT 'pending', claimed_at TEXT, sent_at TEXT, receipt TEXT);
    CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY AUTOINCREMENT, tenant TEXT, event_id TEXT, kind TEXT NOT NULL, data TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS runs(id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL, suite_version TEXT NOT NULL, source TEXT NOT NULL, summary TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
    CREATE TABLE IF NOT EXISTS results(id TEXT PRIMARY KEY, run_id TEXT NOT NULL REFERENCES runs(id), case_id TEXT NOT NULL, tenant TEXT NOT NULL, input TEXT NOT NULL, output TEXT NOT NULL, checks TEXT NOT NULL, judge TEXT, human TEXT, UNIQUE(run_id,case_id));
    CREATE TABLE IF NOT EXISTS trust_history(id INTEGER PRIMARY KEY AUTOINCREMENT, tenant TEXT NOT NULL REFERENCES tenants(id), from_state TEXT NOT NULL, to_state TEXT NOT NULL, actor TEXT NOT NULL, reason TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);
  `);
  return singleton;
}
let transactionDepth = 0;
export function tx<T>(fn: () => T): T {
  const d = db();
  const level = transactionDepth,
    savepoint = `trust_desk_${level}`;
  d.exec(level === 0 ? "BEGIN IMMEDIATE" : `SAVEPOINT ${savepoint}`);
  transactionDepth++;
  try {
    const value = fn();
    if (value instanceof Promise)
      throw Error("Transactions must be synchronous");
    d.exec(level === 0 ? "COMMIT" : `RELEASE SAVEPOINT ${savepoint}`);
    return value;
  } catch (e) {
    d.exec(level === 0 ? "ROLLBACK" : `ROLLBACK TO SAVEPOINT ${savepoint}`);
    if (level !== 0) d.exec(`RELEASE SAVEPOINT ${savepoint}`);
    throw e;
  } finally {
    transactionDepth--;
  }
}
export function audit(
  tenant: string | null,
  event: string | null,
  kind: string,
  data: unknown,
) {
  db()
    .prepare("INSERT INTO audit(tenant,event_id,kind,data) VALUES(?,?,?,?)")
    .run(tenant, event, kind, JSON.stringify(data));
}
export function id() {
  return randomUUID();
}
export function all<T = Record<string, unknown>>(
  sql: string,
  ...params: (string | number | null)[]
): T[] {
  return db()
    .prepare(sql)
    .all(...params) as T[];
}
export function one<T = Record<string, unknown>>(
  sql: string,
  ...params: (string | number | null)[]
): T | undefined {
  return db()
    .prepare(sql)
    .get(...params) as T | undefined;
}

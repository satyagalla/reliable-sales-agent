import { existsSync, readFileSync } from "node:fs";
import { all, audit, db, one, tx } from "./db";
export const snapshotTables = [
  "events",
  "drafts",
  "outbox",
  "audit",
  "runs",
  "results",
  "trust_history",
] as const;
export function snapshot() {
  return {
    version: 1,
    created_at: new Date().toISOString(),
    note: "Recorded local challenge evidence; no credentials. Restore starts supervised and cancels pending deliveries.",
    tables: Object.fromEntries(
      snapshotTables.map((table) => [
        table,
        all(`SELECT * FROM ${table} ORDER BY rowid`),
      ]),
    ),
  };
}
export function restoreSnapshot(path = "artifacts/stored-data.json") {
  if (
    !existsSync(path) ||
    one<{ n: number }>("SELECT count(*) n FROM events")!.n > 0
  )
    return false;
  const input = JSON.parse(readFileSync(path, "utf8"));
  if (input.version !== 1)
    throw Error("Unsupported stored-data snapshot version");
  tx(() => {
    for (const table of snapshotTables) {
      const columns = all<{ name: string }>(`PRAGMA table_info(${table})`).map(
        (c) => c.name,
      );
      const insert = db().prepare(
        `INSERT INTO ${table} (${columns.join(",")}) VALUES (${columns.map(() => "?").join(",")})`,
      );
      for (const original of input.tables[table] || []) {
        const row = { ...original };
        if (table === "outbox" && row.state === "pending")
          row.state = "cancelled";
        if (table === "outbox" && row.state === "claimed")
          row.state = "uncertain";
        if (
          table === "events" &&
          ["queued", "retry", "processing"].includes(row.state)
        ) {
          row.state = "superseded";
          row.token = null;
          row.lease_until = null;
        }
        insert.run(...columns.map((c) => row[c] ?? null));
      }
    }
    db().prepare("UPDATE tenants SET trust='supervised'").run();
    audit(null, null, "stored_evidence_restored", {
      snapshot_created_at: input.created_at,
      trust: "supervised",
      pending_deliveries: "cancelled",
      queued_jobs: "superseded",
      source: "committed_snapshot",
    });
  });
  return true;
}

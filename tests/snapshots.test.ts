import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, writeFileSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { db, one } from "../src/lib/db";
import { restoreSnapshot } from "../src/lib/snapshots";
const root = mkdtempSync(join(tmpdir(), "trust-snapshot-"));
process.env.TRUST_DESK_DB = join(root, "restore.sqlite");
for (const t of JSON.parse(readFileSync("Seed Kit/tenants.json", "utf8"))
  .tenants)
  db()
    .prepare("INSERT INTO tenants(id,config,trust) VALUES(?,?,?)")
    .run(t.id, JSON.stringify(t), "autonomous");
test("offline restore preserves genuine evidence without replaying jobs or deliveries or promoting trust", () => {
  const path = join(root, "stored.json");
  const draft = {
    id: "d1",
    event_id: "e1",
    tenant: "qamar",
    body: "{}",
    pricing: "{}",
    decision: "needs_approval",
    reasons: "[]",
    status: "approved",
    version: 1,
    source: "live_llm",
    created_at: "test",
  };
  writeFileSync(
    path,
    JSON.stringify({
      version: 1,
      created_at: "test",
      tables: {
        events: [
          {
            id: "e1",
            tenant: "qamar",
            channel: "email",
            message_id: "m1",
            thread: "thread",
            sent_at: "test",
            payload: "{}",
            state: "queued",
            attempts: 0,
            available_at: 0,
            created_at: "test",
          },
        ],
        drafts: [draft],
        outbox: [
          {
            id: "o1",
            draft_id: "d1",
            tenant: "qamar",
            body: "recorded reply",
            state: "pending",
          },
        ],
        audit: [],
        runs: [],
        results: [],
        trust_history: [],
      },
    }),
  );
  assert.equal(restoreSnapshot(path), true);
  assert.equal(
    one<{ trust: string }>("SELECT trust FROM tenants WHERE id=?", "qamar")!
      .trust,
    "supervised",
  );
  assert.equal(
    one<{ state: string }>("SELECT state FROM events")!.state,
    "superseded",
  );
  assert.equal(
    one<{ state: string }>("SELECT state FROM outbox")!.state,
    "cancelled",
  );
  assert.equal(
    one<{ source: string }>("SELECT source FROM drafts")!.source,
    "live_llm",
  );
  assert.equal(restoreSnapshot(path), false);
});

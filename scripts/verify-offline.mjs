import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";

const snapshot = JSON.parse(readFileSync("artifacts/stored-data.json", "utf8"));
const directory = mkdtempSync(join(tmpdir(), "trust-offline-"));
const database = join(directory, "review.sqlite");
const env = {
  ...process.env,
  TRUST_DESK_DB: database,
  LLM_PROVIDER: "openai",
  OPENAI_API_KEY: "",
  CODEX_CLI_PATH: join(directory, "intentionally-unavailable"),
};
function seed() {
  const result = spawnSync(
    process.execPath,
    ["node_modules/tsx/dist/cli.mjs", "scripts/seed.ts"],
    { env, encoding: "utf8", timeout: 30000 },
  );
  assert.equal(result.status, 0, result.stderr || result.error?.message);
  return result.stdout.trim();
}
const first = seed();
assert.match(first, /Restored recorded model runs/);
const db = new DatabaseSync(database, { readOnly: true });
const count = (table) => db.prepare(`SELECT count(*) n FROM ${table}`).get().n;
const tables = {};
for (const table of [
  "events",
  "drafts",
  "runs",
  "results",
  "outbox",
  "trust_history",
]) {
  tables[table] = count(table);
  assert.equal(tables[table], snapshot.tables[table].length, table);
}
const actualCalls = db
  .prepare("SELECT count(*) n FROM audit WHERE kind='llm_call'")
  .get().n;
const savedCalls = snapshot.tables.audit.filter(
  (row) => row.kind === "llm_call",
).length;
assert.equal(actualCalls, savedCalls, "No additional inference calls");
assert.equal(
  db.prepare("SELECT count(*) n FROM tenants WHERE trust<>'supervised'").get()
    .n,
  0,
);
assert.equal(
  db
    .prepare(
      "SELECT count(*) n FROM outbox WHERE state IN ('pending','claimed')",
    )
    .get().n,
  0,
);
assert.equal(
  db
    .prepare(
      "SELECT count(*) n FROM events WHERE state IN ('queued','retry','processing')",
    )
    .get().n,
  0,
);
const before = count("audit");
seed();
assert.equal(
  count("audit"),
  before,
  "Repeat seed leaves existing evidence untouched",
);
db.close();
const report = {
  at: new Date().toISOString(),
  method:
    "Fresh temporary SQLite database; seed twice; no API credential or available CLI executable",
  tables,
  recorded_model_attempts: savedCalls,
  new_model_calls: actualCalls - savedCalls,
  active_deliveries: 0,
  active_jobs: 0,
  trust: "supervised",
  repeat_seed_preserves_evidence: true,
};
writeFileSync(
  "artifacts/offline-verification.json",
  JSON.stringify(report, null, 2) + "\n",
);
console.log(JSON.stringify(report, null, 2));

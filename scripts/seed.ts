import { readFileSync } from "node:fs";
import { db, tx, audit } from "../src/lib/db";
import { ingest } from "../src/lib/ingest";
import { persistDraft } from "../src/lib/workflow";
import { fixture } from "../src/lib/fixtures";
import { ChannelEvent, Tenant } from "../src/lib/domain";
import { runEvaluation } from "../src/lib/quality";

async function main() {
  const tenants = JSON.parse(readFileSync("Seed Kit/tenants.json", "utf8"))
    .tenants as Tenant[];
  tx(() => {
    for (const t of tenants) {
      db()
        .prepare("INSERT OR IGNORE INTO tenants(id,config) VALUES(?,?)")
        .run(t.id, JSON.stringify(t));
      const prices = JSON.parse(
        readFileSync(`Seed Kit/prices-${t.id}.json`, "utf8"),
      );
      for (const row of prices.rows)
        db()
          .prepare(
            "INSERT OR IGNORE INTO prices(tenant,row_id,version,data) VALUES(?,?,?,?)",
          )
          .run(t.id, row.id, prices.version, JSON.stringify(row));
    }
  });
  const events = readFileSync("Seed Kit/events.jsonl", "utf8")
    .trim()
    .split(/\r?\n/)
    .map((s) => JSON.parse(s) as ChannelEvent);
  for (const e of events) {
    const result = ingest(e, "seed_cli");
    if (!result.duplicate && !process.argv.includes("--live")) {
      try {
        persistDraft(
          { id: result.id, tenant: result.tenant },
          fixture(e.event_id),
          "fixture",
        );
      } catch (error) {
        throw new Error("Fixture " + e.event_id + ": " + String(error));
      }
    }
  }
  if (!process.argv.includes("--live")) {
    await runEvaluation("baseline", "fixture");
    await runEvaluation("degraded", "fixture");
  }
  audit(null, null, "seed_completed", {
    events: events.length,
    mode: process.argv.includes("--live")
      ? "queued_for_live_llm"
      : "explicit_fixtures",
  });
  console.log(
    "Seed complete. Fixture data is explicitly labelled; no model calls or human labels were fabricated.",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

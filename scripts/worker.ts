import { all, db, tx, audit } from "../src/lib/db";
import { workOne, dispatchOne } from "../src/lib/workflow";
import { setTimeout } from "node:timers/promises";
import { modelConfigured } from "../src/lib/llm";
let redrafted = false;
async function main() {
  if (!modelConfigured())
    throw Error(
      "No OPENAI_API_KEY. Add it to .env. Stored inbox and quality pages still work.",
    );
  if (process.argv.includes("--redraft") && !redrafted)
    tx(() => {
      for (const d of all<{ id: string; event_id: string; tenant: string }>(
        "SELECT * FROM drafts WHERE source='fixture' AND status IN ('needs_approval','hand_off','drop')",
      )) {
        db()
          .prepare(
            "UPDATE drafts SET status='superseded',version=version+1 WHERE id=?",
          )
          .run(d.id);
        db()
          .prepare(
            "UPDATE events SET state='queued',attempts=0 WHERE id=? AND state='done'",
          )
          .run(d.event_id);
        audit(d.tenant, d.event_id, "live_redraft_requested", {});
      }
      redrafted = true;
    });
  let count = 0;
  while (await workOne()) {
    count++;
    if (count > 100) break;
  }
  while (await dispatchOne()) {}
  console.log(
    "Worker pass completed:",
    count,
    "jobs. Retry jobs become eligible after backoff; run again or use --watch.",
  );
}
async function start() {
  do {
    await main();
    if (process.argv.includes("--watch")) await setTimeout(2000);
  } while (process.argv.includes("--watch"));
}
start().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

import { DatabaseSync } from "node:sqlite";
const db = new DatabaseSync(
  process.env.TRUST_DESK_DB || "data/trust-desk.sqlite",
  { readOnly: true },
);
const calls = db
  .prepare("SELECT data FROM audit WHERE kind='llm_call'")
  .all()
  .map((r) => JSON.parse(r.data));
if (process.argv.includes("--failures")) {
  const latest = db
    .prepare(
      "SELECT id FROM runs WHERE source='live_llm' AND kind='baseline' ORDER BY rowid DESC LIMIT 1",
    )
    .get();
  const failed = latest
    ? db
        .prepare(
          "SELECT case_id,input,output,checks,judge FROM results WHERE run_id=?",
        )
        .all(latest.id)
        .map((r) => ({
          ...r,
          input: JSON.parse(r.input),
          output: JSON.parse(r.output),
          checks: JSON.parse(r.checks),
          judge: r.judge ? JSON.parse(r.judge) : null,
        }))
        .filter(
          (r) =>
            r.checks.some((c) => !c.pass) ||
            Object.values(r.judge || {}).some((j) => j.score === 0),
        )
    : [];
  console.log(JSON.stringify(failed, null, 2));
  process.exit(0);
}
console.log(
  JSON.stringify(
    {
      queue: db
        .prepare("SELECT state,count(*) count FROM events GROUP BY state")
        .all(),
      drafts: db
        .prepare(
          "SELECT source,status,count(*) count FROM drafts GROUP BY source,status",
        )
        .all(),
      model_attempts: calls.length,
      successful_calls: calls.filter((c) => c.status === "ok").length,
      total_tokens: calls.reduce(
        (n, c) =>
          n + (c.usage?.prompt_tokens || 0) + (c.usage?.completion_tokens || 0),
        0,
      ),
      successful_cli_tool_calls: calls
        .filter((c) => c.status === "ok")
        .reduce((n, c) => n + (c.cli_trace?.tool_calls || 0), 0),
      runs: db
        .prepare(
          "SELECT r.id,r.name,r.summary,count(x.id) completed FROM runs r LEFT JOIN results x ON x.run_id=r.id GROUP BY r.id ORDER BY r.rowid DESC LIMIT 4",
        )
        .all()
        .map((r) => ({ ...r, summary: JSON.parse(r.summary) })),
      last_attempts: calls.slice(-3).map((c) => ({
        purpose: c.purpose,
        status: c.status,
        error: c.error,
        latency_ms: c.latency_ms,
        provider: c.provider,
      })),
    },
    null,
    2,
  ),
);

import { mkdirSync, writeFileSync } from "node:fs";
import { all } from "../src/lib/db";
import { calibration } from "../src/lib/quality";
mkdirSync("artifacts", { recursive: true });
const runs = all<{ id: string; kind: string; source: string; summary: string }>(
  "SELECT * FROM runs ORDER BY rowid",
);
for (const run of runs) {
  const results = all<{
    human: string | null;
    judge: string | null;
    input: string;
    output: string;
    checks: string;
  }>("SELECT * FROM results WHERE run_id=? ORDER BY case_id", run.id);
  writeFileSync(
    `artifacts/${run.source}-${run.kind}-${run.id.slice(0, 8)}.json`,
    JSON.stringify(
      {
        ...run,
        summary: JSON.parse(run.summary),
        calibration: calibration(results),
        results: results.map((r) => ({
          ...r,
          input: JSON.parse(r.input),
          output: JSON.parse(r.output),
          checks: JSON.parse(r.checks),
          judge: r.judge ? JSON.parse(r.judge) : null,
          human: r.human ? JSON.parse(r.human) : null,
        })),
      },
      null,
      2,
    ) + "\n",
  );
}
const provenance = all(
  "SELECT * FROM audit WHERE kind=? ORDER BY id",
  "llm_call",
);
writeFileSync(
  "artifacts/model-calls.json",
  JSON.stringify(provenance, null, 2) + "\n",
);
writeFileSync(
  "artifacts/trust-history.json",
  JSON.stringify(all("SELECT * FROM trust_history ORDER BY id"), null, 2) +
    "\n",
);
console.log(
  "Exported",
  runs.length,
  "stored runs and",
  provenance.length,
  "real model call records. No credentials exported.",
);

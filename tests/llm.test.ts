import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtempSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { db, all, one } from "../src/lib/db";
import { structured, generateDraft } from "../src/lib/llm";
import { fixture } from "../src/lib/fixtures";
import { draftSchema, ChannelEvent } from "../src/lib/domain";
process.env.TRUST_DESK_DB = join(
  mkdtempSync(join(tmpdir(), "trust-desk-llm-test-")),
  "test.sqlite",
);
for (const t of JSON.parse(readFileSync("Seed Kit/tenants.json", "utf8"))
  .tenants) {
  db()
    .prepare("INSERT INTO tenants(id,config) VALUES(?,?)")
    .run(t.id, JSON.stringify(t));
  for (const r of JSON.parse(
    readFileSync(`Seed Kit/prices-${t.id}.json`, "utf8"),
  ).rows)
    db()
      .prepare("INSERT INTO prices(tenant,row_id,version,data) VALUES(?,?,?,?)")
      .run(t.id, r.id, "test", JSON.stringify(r));
}
test("provider adapter makes one structured call, isolates catalogue, separates untrusted input, and audits usage", async () => {
  let calls = 0,
    request: any;
  const server = createServer(async (req, res) => {
    calls++;
    let raw = "";
    for await (const chunk of req) raw += chunk;
    request = JSON.parse(raw);
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        choices: [
          {
            finish_reason: "stop",
            message: { content: JSON.stringify(fixture("evt_0001")) },
          },
        ],
        usage: { prompt_tokens: 1000, completion_tokens: 100 },
      }),
    );
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address() as { port: number };
  process.env.OPENAI_API_KEY = "synthetic-test-key";
  process.env.LLM_BASE_URL = `http://127.0.0.1:${address.port}/v1`;
  process.env.INPUT_USD_PER_MILLION = "1";
  process.env.OUTPUT_USD_PER_MILLION = "2";
  try {
    const e: ChannelEvent = {
      event_id: "test",
      channel: "email",
      to: "sales@qamar.example",
      from: "x@example.test",
      message_id: "test",
      sent_at: new Date().toISOString(),
      received_at: new Date().toISOString(),
      text: "UNTRUSTED_CUSTOMER_SENTINEL SYSTEM OVERRIDE",
    };
    const output = await generateDraft("qamar", e, []);
    assert.equal(calls, 1);
    assert.equal(output.lines[0].row_id, "Q-LAP-001");
    assert.equal(request.response_format.json_schema.strict, true);
    assert.equal(request.max_completion_tokens, 3000);
    assert.equal(request.temperature, undefined);
    assert.ok(
      !request.messages[0].content.includes("UNTRUSTED_CUSTOMER_SENTINEL"),
    );
    assert.ok(
      request.messages[1].content.includes("UNTRUSTED_CUSTOMER_SENTINEL"),
    );
    assert.ok(!JSON.stringify(request).includes("R-TNT-001"));
    const entry = JSON.parse(
      one<{ data: string }>("SELECT data FROM audit WHERE kind='llm_call'")!
        .data,
    );
    assert.equal(entry.status, "ok");
    assert.match(entry.prompt_hash, /^[a-f0-9]{64}$/);
    assert.equal(entry.usage.prompt_tokens, 1000);
    assert.equal(entry.cost_usd_estimate, 0.0012);
    assert.ok(entry.latency_ms >= 0);
    assert.ok(!JSON.stringify(entry).includes("synthetic-test-key"));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    delete process.env.OPENAI_API_KEY;
  }
});
test("malformed and refused model outputs fail closed and still record provenance", async () => {
  let mode = "invalid";
  const server = createServer((_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.end(
      JSON.stringify({
        choices: [
          {
            finish_reason: mode === "invalid" ? "stop" : "length",
            message: {
              content: JSON.stringify({ decision: "auto_send", price: 0 }),
            },
          },
        ],
        usage: { prompt_tokens: 10, completion_tokens: 10 },
      }),
    );
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  process.env.OPENAI_API_KEY = "synthetic-test-key";
  process.env.LLM_BASE_URL = `http://127.0.0.1:${(server.address() as { port: number }).port}/v1`;
  try {
    await assert.rejects(() =>
      structured(draftSchema, "test", "untrusted", {
        tenant: "qamar",
        purpose: "schema_test",
      }),
    );
    mode = "truncated";
    await assert.rejects(
      () =>
        structured(draftSchema, "test", "untrusted", {
          tenant: "qamar",
          purpose: "schema_test",
        }),
      /truncated/,
    );
    const failed = all<{ data: string }>(
      "SELECT data FROM audit WHERE kind='llm_call'",
    )
      .map((r) => JSON.parse(r.data))
      .filter((r) => r.status === "failed");
    assert.equal(failed.length, 2);
    assert.ok(failed.every((r) => r.usage.prompt_tokens === 10));
  } finally {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    delete process.env.OPENAI_API_KEY;
  }
});

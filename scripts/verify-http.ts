import assert from "node:assert/strict";
import { mkdirSync, writeFileSync } from "node:fs";
const base = process.env.APP_URL || "http://127.0.0.1:3000";
async function main() {
  const results: unknown[] = [];
  for (const route of ["/", "/?tenant=rimal", "/quality", "/audit"]) {
    const r = await fetch(base + route),
      html = await r.text();
    assert.equal(r.status, 200, route);
    assert.ok(html.includes("Trust Desk"), route);
    assert.ok(!html.includes("Internal Server Error"), route);
    if (route !== "/audit") assert.ok(html.includes('dir="rtl"'), route);
    results.push({
      route,
      status: r.status,
      bytes: html.length,
      rtl_markup: html.includes('dir="rtl"'),
    });
  }
  for (const origin of [null, "https://hostile.example"]) {
    const r = await fetch(base + "/api/actions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(origin ? { Origin: origin } : {}),
      },
      body: JSON.stringify({ type: "dispatch" }),
    });
    assert.equal(r.status, 403);
    results.push({
      check: "reject cross-origin mutation",
      origin,
      status: r.status,
    });
  }
  const unsigned = await fetch(base + "/api/events", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
  });
  assert.equal(unsigned.status, 401);
  results.push({ check: "reject unsigned event", status: unsigned.status });
  const invalid = await fetch(base + "/api/actions", {
    method: "POST",
    headers: { Origin: base, "Content-Type": "application/json" },
    body: JSON.stringify({
      type: "trust",
      tenant: "qamar",
      actor: "invalid",
      next: "autonomous",
    }),
  });
  assert.equal(invalid.status, 409);
  results.push({
    check: "reject unauthorized promotion",
    status: invalid.status,
  });
  mkdirSync("artifacts", { recursive: true });
  writeFileSync(
    "artifacts/http-verification.json",
    JSON.stringify(
      {
        at: new Date().toISOString(),
        base,
        method: "HTTP assertions; no browser visual inspection",
        results,
      },
      null,
      2,
    ) + "\n",
  );
  console.log(
    "Passed",
    results.length,
    "HTTP checks. Visual browser inspection is not covered.",
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

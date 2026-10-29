import { readFileSync } from "node:fs";
import { generateDraft, selectedModel } from "../src/lib/llm";
import { catalogue, tenant } from "../src/lib/catalogue";
import { decide, priceDraft, renderReply } from "../src/lib/policy";
import { one } from "../src/lib/db";
async function main() {
  const e = JSON.parse(
    readFileSync("Seed Kit/events.jsonl", "utf8").split(/\r?\n/)[1],
  );
  const draft = await generateDraft("qamar", e, []),
    t = tenant("qamar"),
    pricing = priceDraft(t, catalogue("qamar"), draft),
    decision = decide(t, draft, pricing, "supervised", e.text);
  console.log(
    JSON.stringify(
      {
        model: selectedModel(),
        draft,
        pricing,
        ...decision,
        reply: renderReply(
          t,
          draft,
          pricing,
          false,
          e.text,
          catalogue("qamar"),
        ),
      },
      null,
      2,
    ),
  );
  console.log(
    "Call audit:",
    one(
      "SELECT data FROM audit WHERE kind=? ORDER BY id DESC LIMIT 1",
      "llm_call",
    ),
  );
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});

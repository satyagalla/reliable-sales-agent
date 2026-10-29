import { runEvaluation } from "../src/lib/quality";
import { modelConfigured } from "../src/lib/llm";
if (!process.argv.includes("--fixture") && !modelConfigured()) {
  console.error(
    "Configure an authenticated codex_cli provider or OPENAI_API_KEY in .env before real evaluations. Use --fixture for explicit offline fixtures.",
  );
  process.exitCode = 1;
} else
  runEvaluation(
    process.argv.includes("--degraded") ? "degraded" : "baseline",
    process.argv.includes("--fixture") ? "fixture" : "live_llm",
  )
    .then((id) => console.log("Stored evaluation:", id))
    .catch((e) => {
      console.error(e);
      process.exitCode = 1;
    });

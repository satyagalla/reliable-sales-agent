import { runEvaluation } from "../src/lib/quality";
if (!process.argv.includes("--fixture") && !process.env.OPENAI_API_KEY) {
  console.error(
    "Add OPENAI_API_KEY to .env before real evaluations. Use --fixture for explicit offline fixtures.",
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

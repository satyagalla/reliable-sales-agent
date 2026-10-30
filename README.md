# Trust Desk

An inbound officer for Qamar Devices (Dubai) and Rimal Event Supply (Riyadh). **Agents draft. Code decides.** Next.js + TypeScript + SQLite; no agent frameworks or tool loops.

## Start in three commands

Prerequisite: **Node 22.13+** and npm. SQLite is built into Node; no database server, Docker or native compilation.

```sh
npm ci
npm run seed
npm run dev
```

Open **http://127.0.0.1:3000**. A fresh seed restores the committed, recorded inbox, model runs and audit without an API key or CLI login. Restore starts supervised and cancels pending deliveries; it never replays model calls. Seeding an existing database preserves decisions, labels and trust. Without the snapshot, seed creates explicitly labelled fixtures.

This development machine has global Node 16 and an ignored, checksum-verified Node 22 runtime in `.tools/`. Use the wrapper below; replace `ci` with `run seed`, `run dev`, `test`, etc. On another machine install Node 22.13+ first. `npm.cmd` avoids PowerShell's npm.ps1 restriction.

```powershell
powershell -ExecutionPolicy Bypass -File scripts/run.ps1 ci
```

## Evidence and completion status

- The supplied `Seed Kit/` is preserved. Thirteen events enter durable ingestion, including duplicate delivery, correction and spoofed tenant metadata.
- The recorded seed inbox contains eleven current **REAL LLM** drafts; older fixture drafts remain superseded. Explicit **FIXTURE** badges distinguish authored extractions from genuine model outputs.
- Thirty-six versioned cases execute deterministic expectations. Both fixture and genuine CLI baseline/degraded runs are stored and exported under `artifacts/`. The first live baseline passed 35/36 hard checks but failed the helpfulness gate. Its evidence is preserved. The live degraded run failed 36/36 deterministic cases and all three judge dimensions for every case, correctly blocking the gate.
- Genuine draft/judge adapters support OpenAI HTTP and an authenticated local Codex CLI. The CLI smoke test produced a real Arabic purchase draft with recorded usage and zero tool calls. Stored model-attempt records distinguish successful inference from startup failures; final baseline/degraded evidence is exported under `artifacts/`.
- **Sol baseline `64a3bad9`: 36/36 deterministic cases pass; both tenant quality/regression gates pass.** Qamar's grounding/instruction/helpfulness means are 1.89/1.94/1.72; Rimal's are 2.00/2.00/1.94, out of 2. There are no zero scores or not-assessable dimensions. The unchanged threshold is 1.5. Earlier failed runs remain available.
- **Initial Luna comparison `36577a75`: GPT-5.6 Luna at low effort passed 34/36 deterministic cases and failed both tenant quality/regression gates.** The code/suite hashes and Sol judge were unchanged from the Sol baseline. Arabic delivery and booking requests were routed to handoff instead of approval; the latter selected an unrelated equipment-support reply. The judge also flagged a recorded injected discount in a raw draft, although the outbound refused it. See `artifacts/model-comparison-luna-low.json` for the preserved comparison before improvements. The revised prompt distinguishes ordinary commitment requests from support and instruction attacks; outbound guards reject unsupported fault templates and hypothetical pricing terms. The latest stored live gate determines promotion. Every successful CLI trace reports zero tool calls. Dollar cost is unknown.
- **Personal calibration is pending:** personally assess at least ten live outputs in `/quality`, preferably five per tenant. Labels are never auto-filled. Exact dimension agreement excludes not-assessable ratings.
- The original handler source is missing. `REVIEW.md` reviews the supplied defect list without inventing original line numbers.
- Browser discovery found no connection. HTTP verification does not claim visual verification. Record the Loom personally using `LOOM-SCRIPT.md`.

## Genuine drafts and judge runs

For the local CLI path, install/sign in to Codex CLI (`codex login`) and place these non-secret settings in `.env`. The development machine already has CLI 0.164.0 signed in. The draft default is `gpt-5.6-luna` at low effort; the independent judge remains `gpt-6.1-sol` at low effort. Recorded runs identify both models.

```dotenv
LLM_PROVIDER=codex_cli
CODEX_MODEL=gpt-5.6-luna
CODEX_JUDGE_MODEL=gpt-6.1-sol
```

Run `npm run smoke:model` for one Arabic draft and `npm run status` for stored progress. The adapter uses an isolated temporary directory, a replacement inference-only instruction file, strict output schema, read-only/ephemeral sessions, and disabled execution/apps/browsing/sub-agent features. It rejects tool events or extra turns. Existing CLI authentication is reused without reading or copying credentials. CLI calls have a 75-second timeout; reported token usage is retained and dollar cost stays unknown. This is a local testing adapter, not a production subscription-auth integration. See [official non-interactive CLI documentation](https://learn.chatgpt.com/docs/non-interactive-mode).

For the HTTP alternative, copy `.env.example` to `.env`, leave `LLM_PROVIDER=openai`, and add `OPENAI_API_KEY` locally. Never commit it. Default HTTP draft model: `gpt-5.6-luna`, with explicit low reasoning effort and a 3,000-token completion cap; the judge default is Sol. Request shape follows [official Structured Outputs documentation](https://developers.openai.com/api/docs/guides/structured-outputs?api-mode=chat) and the [Luna model documentation](https://developers.openai.com/api/docs/models/gpt-5.6-luna). HTTP account access remains unverified; other compatible providers are configurable but not tested.

```sh
npm run worker -- --redraft
npm run eval
npm run eval -- --degraded
npm run export
```

`--redraft` supersedes reviewable fixture extractions and calls the genuine provider, preserving approved/rejected history. Alternatively, set `TRUST_DESK_DB` to a new file, seed with `--live`, then run the worker. `worker -- --watch` polls retries. Each attempt makes one draft call, with a 45-second HTTP or 75-second CLI timeout, 90-second token lease, and at most three attempts; there is no model repair loop.

Run baseline before deliberately degraded. Preserve failed evidence. A failed latest live run blocks promotion until a clean passing run. Export again after personal labels. Add verified per-million-token rates to `.env` for USD estimates; unknown rates produce `null`, not fabricated zero cost. Usage comes from the provider.

## Operator flow

1. Select tenant and compare source message, extracted evidence and catalogue amounts. Arabic reply/edit surfaces use RTL.
2. Choose a named tenant approver, then approve/edit/reject. Version checks prevent concurrent approvals. New customer messages invalidate older reviewable drafts and cancel unclaimed replies.
3. Dispatch approved outbox to the **local receipt sink**. Audit retains body, approver, full before/after edit diff, receipt and model provenance. There is no external channel integration.
4. Inspect quality runs and personally label ten real outputs using your name, independent scores and rationales.
5. Promotion requires a passing current live baseline/latest gate for that tenant, ten labels overall, five for the tenant with fifteen comparable scores, and ≥80% exact agreement. Failed live gates/drafts and human zero scores demote automatically. Rimal never auto-sends.

All quotes and commitments need approval. Autonomous Qamar may send only low-risk code-assembled FAQ facts. Human review verifies extraction because schema validation cannot prove semantic correctness.

## Signed ingestion and scope

`POST /api/events` requires `WEBHOOK_SECRET`, `x-trust-timestamp` (Unix seconds or milliseconds), and `x-trust-signature`: lowercase hex HMAC-SHA256 of `timestamp + '.' + rawBody`. Freshness window: five minutes. Signed `(channel,to)` resolves tenant; metadata is ignored. This simulates a trusted gateway, not a provider-native signature adapter.

The CLI seed path is a trusted local import, never an unsigned endpoint. The loopback reviewer console uses named pickers and same-origin mutation checks, **not authenticated identity**. Do not deploy it publicly without authentication/authorization and real provider adapters.

## Verify and submit

```sh
npm test
npm run typecheck
npm run build
npm run verify:http
npm run verify:offline
npm run export
```

Run HTTP checks while the app runs. The offline check seeds a fresh temporary database twice with model credentials disabled, confirms saved evidence is retained, and checks that no model calls, jobs or deliveries replay. Tests use isolated temporary databases and a synthetic provider server, not genuine LLM runs. They cover cross-process dedupe/approval, 500 random money examples, boundaries, malformed output, supersession, uncertain dispatch, recovery, trust and calibration.

Read `DESIGN.md` (under three pages), `REVIEW.md`, `AI-LOG.md`, `TEAM-PLAN.md` (one page) and `LOOM-SCRIPT.md`. Exported runs preserve source labels and calibration; historical fixture suites remain, so select the newest version.

The database is ignored at `data/trust-desk.sqlite`; fresh reviewers restore recorded evidence from `artifacts/stored-data.json` with three startup commands. Submit repository or zip **including `.git`**, with an 8–12 minute Loom URL. Exclude `.env`, `.tools`, `node_modules` and `.next`.

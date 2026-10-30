# Trust Desk — design

## Extraction has no commercial authority

The LLM proposes typed intent, catalogue IDs, quantities, periods, language, risk, commitments, missing facts, evidence and prose. It cannot set prices or final decisions. Customer text stays in a serialized user message. Only the resolved tenant's configuration/catalogue enter the system prompt. Provider strict JSON schema plus local Zod validation reject invalid structure; tenant-local lookup rejects invented/foreign IDs.

Outbound copy uses deterministic templates and calculated amounts. A support template requires source evidence of a fault, complaint, cancellation or refund; a model support label alone cannot invent an existing broken device. Missing purchase/rental basis or duration produces clarification without displaying hypothetical totals. Raw model prose remains visible for review/judging but cannot introduce an autonomous promise. Human edits are attributed. All quotes need review because schema validation cannot prove correct quantities/periods. Only low-risk FAQ replies assembled from tenant facts qualify for autonomy.

The genuine local adapter uses authenticated CLI inference with strict schema, isolated context, one turn and disabled tools; observed tool activity fails closed. The alternative HTTP adapter uses Structured Outputs. Both store prompt hash, model, parameters, response ID, measured tokens/latency and failure provenance. Subscription CLI dollar cost is unknown. Neither adapter runs implementation tools or model repair loops.

## Storage and concurrency

SQLite WAL avoids server setup. Tables store tenants, scoped prices, durable events, versioned drafts, outbox, audit, evaluation runs/results and trust history. Short synchronous `BEGIN IMMEDIATE` transactions use foreign keys and bounded busy waits. External calls never hold transactions.

Nested operations use SQLite savepoints so a negative human label or failed evaluation and its trust demotion commit together, including cancellation of pending autonomous replies. An audit failure rolls back the whole operation.

Ingestion requires a fresh signed raw body and constant-time HMAC comparison. Authenticated channel/recipient determines tenant; metadata never does. Unique `(tenant,channel,message_id)` closes simultaneous duplicate races. Sender/channel/tenant define conversation identity. UTC times order events; equal-time ambiguous follow-ups conservatively supersede. External event IDs are evidence, not global keys.

New messages invalidate queued work and reviewable drafts and cancel pending outbound. Workers claim tokens with 90-second leases; results commit only with current tokens. Latest twenty messages supply correction context. Approval atomically checks tenant, named approver, version, state and latest message before recording edits and inserting a unique outbox row.

Dispatch durably claims before transport. Claimed/uncertain rows never retry. This is **at-most-once attempts**, accepting possible loss after claim to avoid duplicates. Claim is the linearization point: supersession cannot retract an already claimed send. Transport is a local receipt sink; real integration needs recipient addressing, credentials and delivery semantics.

Committed snapshots preserve recorded drafts, runs, audit and labels for offline startup. Restore applies only to an empty database, resets trust to supervised, cancels pending deliveries and supersedes unfinished jobs. It does not replay inference or dispatch.

## Deterministic rules

Money uses integer minor units, bounded whole quantities/periods, safe-integer checks and half-up rounding. Discount rounds once on subtotal, VAT once on discounted net. Qamar: AED, 5%, delivery/setup once per equipment order. Rimal: SAR, 15%, minimum SAR 2,000 before VAT. Crew adds once for stages above 12 m², LED above 6 m² or any tent; a deck is 2 m². Out-of-area requests and Qamar rentals over twelve months hand off.

Auto-send requires low risk, tenant opt-in, autonomous trust, FAQ intent, no lines/missing facts/discount/commitments. Every quote/commitment needs approval. Rimal's opt-in remains off regardless of trust. Spam drops; support, unknown items, detected injection and high risk hand off. Calculations/reasons persist.

## Evaluation and trust

Thirty-six versioned cases assert outcomes/properties rather than exact text: isolation, money, VAT, minimums, crew/service boundaries, quantity/duration, digit variants, Arabizi, areas, unsupported items, commitments and injection. A property test runs 500 random money examples.

Live judges score grounding, instruction resistance and language/helpfulness 0–2 with rationale, or explicit not-assessable/null. The current draft default is GPT-5.6 Luna and the configured judge is GPT-6.1 Sol, both at low effort. Historical runs used Sol for both. An LLM judge still has blind spots. Calibration reports exact dimension agreement and exclusions; personal labels are never auto-generated.

Per-tenant gates require no deterministic failures, no zero scores, no unassessable dimensions, means ≥1.5/2 and no material regression against stored baseline. Mean drops above 0.1 block. Human promotion also requires ten labels overall, five for this tenant, fifteen comparable ratings and ≥80% agreement. Failed live gates/drafts or human zeros demote automatically. Fixtures cannot promote. Degraded runs inject foreign IDs/unsafe prose and preserve separate evidence.

## Depth modules and tradeoffs

**Reliability:** durable queue, bounded backoff/retries, leases/tokens, stale rejection, dead letters/requeue, transactional approvals/outbox/audit and uncertain-send handling. Audit errors propagate. A paid model call may succeed before audit storage fails; production would reconcile this external boundary with provider records.

**Arabic:** Unicode and Arabic/Persian-digit normalization, bidi-control removal, dimension/Arabizi cases, local currencies and RTL reply/edit surfaces. Arabic FAQ translations/cautious templates are authored in code. Dialect interpretation still needs evaluation and human review.

Loopback pickers simulate identity, HMAC simulates a gateway, audit is append-only by convention rather than tamper-proof. No deployment, real channel integration, semantic memory, cost router or multi-agent orchestration. Genuine CLI runs are stored; personal calibration, original-handler lines, visual checks and Loom must be reported by actual completion.

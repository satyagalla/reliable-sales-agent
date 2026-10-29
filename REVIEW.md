# Handler review

**Source limitation:** original handler source was not supplied and the artifact could not be retrieved. This reviews the supplied defect list. Original line numbers are deliberately absent. Place the original in `Seed Kit/` to complete exact references. Paths below refer to replacement code under `src/lib/`.

| Defect                         | Failure                    | Replacement/evidence                                                                                     |
| ------------------------------ | -------------------------- | -------------------------------------------------------------------------------------------------------- |
| Missing signatures accepted    | Forged routing/text        | `ingest.ts: verify` requires secret, freshness, raw-byte HMAC, constant-time comparison; signature tests |
| Payload tenant trusted         | Tenant/policy bypass       | `ingest` uses signed recipient/channel and ignores metadata; spoof test                                  |
| All prices queried             | Leakage/wrong currency     | `catalogue(tenantId)` scopes query/prompt; `priceDraft` rejects foreign IDs; request-boundary test       |
| Race-prone dedupe              | Duplicate jobs/sends       | Unique tenant/channel/message constraint plus transaction; four independent processes                    |
| Customer text in system        | Instruction escalation     | Serialized user input; typed proposals and code rendering; injection cases                               |
| Unvalidated JSON               | Invented fields/quantities | Provider strict schema + `draftSchema`; malformed/truncated/negative/fraction tests                      |
| Model prices/decisions trusted | Free orders/promises       | Schema excludes them; `priceDraft`, `decide`, `renderReply` own authority                                |
| Hard-coded 5% VAT              | Rimal under-taxed          | Tenant basis points; tested 5%/15% totals                                                                |
| Minor units lost               | Total drift                | Integer money, explicit rounding, 500 randomized examples                                                |
| Direct send                    | Crash/retry duplicates     | Atomic approval/outbox; durable claim; uncertain sends never retry                                       |
| Audit failures swallowed       | Invisible decisions        | Errors propagate/rollback; model provenance recorded in finally                                          |
| Trust/opt-in ignored           | Supervised/Rimal auto-send | Three-condition policy; human-only promotion, automatic demotion tests                                   |
| No supersession                | Old quantity approved      | New event invalidates old work/outbox; token/latest-message checks                                       |
| No approval concurrency        | Multiple decisions         | Atomic version/state/tenant checks and unique outbox; two-process test                                   |

Authenticate ingress, establish tenant independently of metadata, isolate catalogue, validate proposals and calculate policy first. Dedupe/outbox are equally essential: a correct reply can still be harmful when duplicated or sent after correction.

At-most-once attempts accept possible loss after claim; exactly-once delivery is not claimed. Named local actors are not real authentication. Semantic extraction is fallible, so quotes require review. Audit is not tamper-proof. Implementation alone does not prove genuine provider runs or calibration; inspect artifacts and `AI-LOG.md`.

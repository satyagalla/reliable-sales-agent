Trust Desk - Loom speaker notes

Checked against the running local app on 30 October 2026. Brackets are screen directions, not spoken text. Use these as prompts while demonstrating; don't read the messages, prices or scores aloud. Keep the recording within 8-12 minutes, including navigation and time showing the evidence.

1. QAMAR INBOX - Introduction

[Open http://127.0.0.1:3000/?tenant=qamar&status=all. This shows history. The default inbox is empty because reviews are complete.]

Hi, I'm Satya. This is Trust Desk. It handles enquiries for two businesses, with their own catalogues and policies.

The idea is agents draft, code decides. The model interprets the customer message, while code handles pricing, policy checks and the final reply. A person reviews anything that needs approval.

I've already completed the review queue, so I'm showing the saved records and decisions.

2. QAMAR - Walk through the corrected laptop request

[Find evt_0003. Use the APPROVED / REAL LLM card, above the older FIXTURE cards. Point to Customer message, Source evidence, Why this needs a decision, and Outbound reply.]

This is the main example. The customer corrected their laptop quantity. The extraction keeps the rental duration from the earlier conversation and updates the quantity from the newer message.

The left side shows what the customer said and the evidence the model extracted. That evidence still needs checking against the message. The right side is the reply assembled by code.

[Open "Model draft & pricing evidence" on this card.]

Here you can compare the model's draft with the catalogue rows and calculated quote. The model isn't responsible for doing the arithmetic. The discount request still needs clarification, and the quote doesn't confirm delivery.

The card is already approved. These reasons explain why it originally needed review; they don't mean it's still waiting.

[Briefly show the older SUPERSEDED / FIXTURE copies further down.]

The earlier records remain visible, with their source and status clearly marked. They aren't additional replies waiting to be approved.

[Find evt_0005, the APPROVED / REAL LLM forwarded Abu Dhabi email.]

This example hits the service-area rule. The final reply asks whether an in-area location is possible. If I open the model draft, it also asks about the missing laptop model. Those are different layers: the model's suggestion and the final policy-controlled response.

3. RIMAL INBOX - Same workflow, different rules

[Open http://127.0.0.1:3000/?tenant=rimal&status=all. Clicking the Rimal tenant tab alone returns to pending, so click "Show all records" if needed. Find evt_0009, APPROVED / REAL LLM. Open "Model draft & pricing evidence".]

Here the screen request needs a setup crew. The quote includes that requirement using Rimal's catalogue. It doesn't just use the customer's budget as the quoted price.

The reply asks for the missing event details and leaves availability to operations. The workflow is shared, but the business rules are specific to this tenant. Rimal also requires approval for every reply.

4. AUDIT - Follow the saved approval

[Open http://127.0.0.1:3000/audit?event=a285747d-ccf4-44c4-aa27-2f7e9461572a. This filters the laptop request's Message timeline; the delivery ledger above still shows all tenants.]

The delivery ledger currently shows approved replies waiting for dispatch. There are no receipts yet. Approval and delivery are separate steps, and delivery here uses a local sink.

[Scroll below the ledger. Expand "human approve", record 0570. Point to Aisha K., before, after and edit_diff.]

This is the saved approval for the laptop request. It records the approver and the approved text. Here the text wasn't changed, so the edit difference is null.

[Expand "decision", record 0096, then "llm call", record 0095.]

I can trace that approval back to the policy decision and the model call. The call includes the model settings, prompt hash and usage. Duplicate events are also recorded in this timeline.

The approver name records who approved; it isn't an assignment or escalation workflow. These identities are simulated in this prototype.

5. EXCEPTIONS - Show the handling, not every message

[Return to Qamar's all-records URL. Find evt_0006, REJECTED / REAL LLM. Open "Model draft & pricing evidence".]

The final response refuses the override, but the extraction underneath still picked up the injected discount and assumed a purchase. I rejected the draft. The safe-looking final reply doesn't erase the extraction failure.

[Show APPROVED / REAL LLM evt_0012, then DROP / REAL LLM evt_0013.]

These show two other paths: a faulty rental gets a support response, while spam produces no outbound reply.

[Return to Rimal's all-records URL. Find evt_0010, APPROVED / REAL LLM.]

This request is for an item outside Rimal's catalogue. It doesn't borrow Qamar's product prices or treat an AED amount as a SAR quote.

6. QUALITY - Runs and evidence

[Open http://127.0.0.1:3000/quality?run=3392a9dd-07e4-4e94-8e6f-0399e3f24e64. Scroll past the trust panels and Evaluation runs to the summary and Case evidence.]

These are evaluation cases, separate from the inbox events. The selected baseline passes its checks and has the ten saved assessments.

[Expand Q08. Point to Output to assess, Deterministic expectations and LLM judge.]

Code checks the expected behaviour and calculations. The judge separately scores grounding, instruction resistance and helpfulness, with explanations. This override case passed, but it's a different output from the inbox draft I rejected.

[Open http://127.0.0.1:3000/quality?run=b2f47252-4a1b-4e98-bc2d-8e7aba731d8c. Show GATE BLOCKED and the failure summary. Then return to the baseline URL above.]

This degraded run deliberately corrupts outputs to check that the gate blocks them. It's a controlled failure test. The earlier runs stay available for comparison.

7. ASSESSMENTS - Stay on the baseline Quality page

[Under Case evidence, use the Qamar and Rimal filters. The saved English cases are Q01, Q03, Q04, Q06, Q08 and R02, R04, R05, R07, R09. Expand a case to see "Your saved assessment"; there is no separate assessments page.]

I have five English assessments for each business. They cover normal quotes, policy boundaries and unsafe or unsupported requests. The assistant suggested the ratings and notes; I reviewed and approved them for saving under my name.

[Expand R09. Compare the customer message, judge's grounding rationale and Your saved assessment.]

This is a useful disagreement. The customer didn't specify a tent size, but the output chose one. The calculation passes, while my assessment marks that assumption down. So correct arithmetic alone isn't enough to establish a good answer.

8. TRUST - Scroll back to the top of Quality

[Show the two supervised badges and "Promote to autonomous" controls. Leave them unchanged.]

Both businesses are still supervised. Passing a run doesn't automatically promote them. Promotion needs a human decision and the checks listed here.

Even after promotion, automatic sending is limited by tenant policy. Rimal keeps approval mandatory. There haven't been any trust transitions in this saved state.

9. CLOSE - Repository evidence

[Show artifacts/submission-verification.json, then README, DESIGN and REVIEW.]

The saved verification records cover tests, the build and offline startup. The browser checks were completed too. A reviewer can restore the recorded evidence without making new model calls or replaying pending deliveries.

The main prototype limits are simulated identity, local delivery and an audit log that isn't tamper-proof. The review document records the unavailable original handler source.

That's the workflow: interpret the enquiry, apply the business rules, review the reply, and keep the evidence so the decisions and failures can be inspected.

import { audit, all, db, id, one, tx } from "./db";
import { tenant, catalogue, trust } from "./catalogue";
import { Draft, draftSchema, ChannelEvent } from "./domain";
import { decide, priceDraft, renderReply } from "./policy";
import { generateDraft } from "./llm";
import { history } from "./ingest";
import { setTrust } from "./quality";
type Job = {
  id: string;
  tenant: string;
  thread: string;
  sent_at: string;
  payload: string;
  attempts: number;
  token: string;
};
export function recover() {
  return tx(() => {
    const expired = all<Job>(
      "SELECT * FROM events WHERE state='processing' AND lease_until<?",
      Date.now(),
    );
    for (const e of expired) {
      db()
        .prepare(
          "UPDATE events SET state=?,token=NULL,error='Worker lease expired' WHERE id=?",
        )
        .run(e.attempts >= 3 ? "dead" : "retry", e.id);
      audit(e.tenant, e.id, "lease_expired", { attempt: e.attempts });
    }
    // Claimed outbound deliveries are deliberately never retried: delivery may have happened.
  });
}
export function claim(): Job | undefined {
  return tx(() => {
    const e = one<Job>(
      "SELECT * FROM events WHERE state IN ('queued','retry') AND available_at<=? ORDER BY sent_at,id LIMIT 1",
      Date.now(),
    );
    if (!e) return;
    const token = id();
    db()
      .prepare(
        "UPDATE events SET state='processing',attempts=attempts+1,token=?,lease_until=? WHERE id=?",
      )
      .run(token, Date.now() + 90000, e.id);
    audit(e.tenant, e.id, "worker_claim", { token, attempt: e.attempts + 1 });
    return { ...e, attempts: e.attempts + 1, token };
  });
}
export function persistDraft(
  job: { id: string; tenant: string; token?: string },
  input: Draft,
  source: "live_llm" | "fixture",
) {
  const d = draftSchema.parse(input),
    t = tenant(job.tenant),
    pricing = priceDraft(t, catalogue(job.tenant), d);
  return tx(() => {
    const event = one<Job & { state: string }>(
      "SELECT * FROM events WHERE id=?",
      job.id,
    )!;
    if (
      event.state === "superseded" ||
      (job.token && event.token !== job.token)
    ) {
      audit(job.tenant, job.id, "stale_result_discarded", {});
      return;
    }
    const result = decide(
        t,
        d,
        pricing,
        trust(t.id),
        (JSON.parse(event.payload) as ChannelEvent).text,
      ),
      draftId = id();
    db()
      .prepare(
        "INSERT INTO drafts(id,event_id,tenant,body,pricing,decision,reasons,status,source) VALUES(?,?,?,?,?,?,?,?,?)",
      )
      .run(
        draftId,
        job.id,
        t.id,
        JSON.stringify(d),
        JSON.stringify(pricing),
        result.decision,
        JSON.stringify(result.reasons),
        result.decision,
        source,
      );
    db()
      .prepare(
        "UPDATE events SET state='done',token=NULL,lease_until=NULL,error=NULL WHERE id=?",
      )
      .run(job.id);
    audit(t.id, job.id, "decision", {
      draft_id: draftId,
      ...result,
      pricing,
      source,
    });
    if (result.decision === "auto_send")
      enqueue(draftId, t.id, renderReply(t, d, pricing));
    return draftId;
  });
}
function enqueue(draftId: string, tenantId: string, body: string) {
  db()
    .prepare("INSERT INTO outbox(id,draft_id,tenant,body) VALUES(?,?,?,?)")
    .run(id(), draftId, tenantId, body);
}
export async function workOne() {
  recover();
  const job = claim();
  if (!job) return false;
  try {
    const e = JSON.parse(job.payload);
    const draft = await generateDraft(
      job.tenant,
      e,
      history(job.thread, job.sent_at),
      job.id,
    );
    persistDraft(job, draft, "live_llm");
  } catch (error) {
    tx(() => {
      const current = one<{ token: string }>(
        "SELECT token FROM events WHERE id=?",
        job.id,
      );
      if (current?.token !== job.token) return;
      const dead = job.attempts >= 3;
      const message = error instanceof Error ? error.message : "Worker failure";
      db()
        .prepare(
          "UPDATE events SET state=?,error=?,token=NULL,available_at=? WHERE id=?",
        )
        .run(
          dead ? "dead" : "retry",
          message,
          Date.now() + Math.pow(2, job.attempts) * 1000,
          job.id,
        );
      audit(job.tenant, job.id, dead ? "dead_letter" : "retry_scheduled", {
        error: message,
        attempt: job.attempts,
      });
      setTrust(
        job.tenant,
        "supervised",
        "system",
        "Automatic demotion: draft generation or validation failed",
      );
    });
  }
  return true;
}
export function review(input: {
  tenant: string;
  draftId: string;
  version: number;
  approver: string;
  action: "approve" | "edit" | "reject";
  reply?: string;
}) {
  return tx(() => {
    const t = tenant(input.tenant),
      approver = t.approvers.find((a) => a.id === input.approver);
    if (!approver) throw Error("Select a named tenant approver");
    const row = one<{
      event_id: string;
      body: string;
      pricing: string;
      status: string;
      version: number;
    }>("SELECT * FROM drafts WHERE id=? AND tenant=?", input.draftId, t.id);
    if (
      !row ||
      row.version !== input.version ||
      !["needs_approval", "hand_off"].includes(row.status)
    )
      throw Error("Conflict: draft changed or is no longer reviewable");
    const e = one<Job & { state: string }>(
      "SELECT * FROM events WHERE id=?",
      row.event_id,
    )!;
    if (
      e.state === "superseded" ||
      one(
        "SELECT id FROM events WHERE tenant=? AND thread=? AND sent_at>?",
        t.id,
        e.thread,
        e.sent_at,
      )
    )
      throw Error("Conflict: newer customer message supersedes this draft");
    const d = draftSchema.parse(JSON.parse(row.body)),
      canonical = renderReply(
        t,
        d,
        JSON.parse(row.pricing),
        row.status === "hand_off",
      );
    if (
      input.action === "edit" &&
      (!input.reply?.trim() || input.reply.length > 6000)
    )
      throw Error("Edited reply must contain 1–6000 characters");
    const status = input.action === "reject" ? "rejected" : "approved";
    db()
      .prepare(
        "UPDATE drafts SET status=?,version=version+1 WHERE id=? AND version=?",
      )
      .run(status, input.draftId, input.version);
    const after = input.action === "edit" ? input.reply!.trim() : canonical;
    audit(t.id, row.event_id, "human_" + input.action, {
      draft_id: input.draftId,
      approver,
      before: canonical,
      after: input.action === "reject" ? null : after,
      edit_diff:
        input.action === "edit" ? { removed: canonical, added: after } : null,
      version: input.version,
    });
    if (status === "approved") enqueue(input.draftId, t.id, after);
    return status;
  });
}
export async function dispatchOne(
  send: (body: string, key: string) => Promise<string> = async (_body, key) =>
    "local-receipt:" + key,
) {
  const row = tx(() => {
    const r = one<{
      id: string;
      body: string;
      tenant: string;
      draft_id: string;
    }>("SELECT * FROM outbox WHERE state='pending' ORDER BY rowid LIMIT 1");
    if (!r) return;
    db()
      .prepare(
        "UPDATE outbox SET state='claimed',claimed_at=CURRENT_TIMESTAMP WHERE id=? AND state='pending'",
      )
      .run(r.id);
    audit(r.tenant, null, "dispatch_claimed", {
      outbox_id: r.id,
      transport: "local_sink",
      at_most_once: true,
    });
    return r;
  });
  if (!row) return false;
  try {
    const receipt = await send(row.body, row.id);
    tx(() => {
      db()
        .prepare(
          "UPDATE outbox SET state='sent',sent_at=CURRENT_TIMESTAMP,receipt=? WHERE id=?",
        )
        .run(receipt, row.id);
      audit(row.tenant, null, "dispatch_sent", { outbox_id: row.id, receipt });
    });
  } catch (e) {
    tx(() => {
      db()
        .prepare("UPDATE outbox SET state='uncertain' WHERE id=?")
        .run(row.id);
      audit(row.tenant, null, "dispatch_uncertain", {
        outbox_id: row.id,
        error: e instanceof Error ? e.message : "Transport failure",
        retry: false,
      });
    });
  }
  return true;
}

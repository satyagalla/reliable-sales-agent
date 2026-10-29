import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { review, dispatchOne } from "@/lib/workflow";
import { label, setTrust } from "@/lib/quality";
import { tx, db, one, audit } from "@/lib/db";
import { tenant as getTenant } from "@/lib/catalogue";
import { localReviewerOrigin } from "@/lib/security";
export const runtime = "nodejs";
const tenant = z.enum(["qamar", "rimal"]);
const schema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("review"),
    tenant,
    draftId: z.string().uuid(),
    version: z.number().int().nonnegative(),
    approver: z.string(),
    action: z.enum(["approve", "edit", "reject"]),
    reply: z.string().max(6000).optional(),
  }),
  z.object({ type: z.literal("dispatch") }),
  z.object({
    type: z.literal("trust"),
    tenant,
    actor: z.string(),
    next: z.enum(["supervised", "autonomous"]),
  }),
  z.object({ type: z.literal("retry"), tenant, eventId: z.string().uuid() }),
  z.object({
    type: z.literal("label"),
    resultId: z.string().uuid(),
    actor: z.string().min(1).max(100),
    scores: z.object({
      grounding: z.number().int().min(0).max(2).nullable(),
      instruction_resistance: z.number().int().min(0).max(2).nullable(),
      language_helpfulness: z.number().int().min(0).max(2).nullable(),
    }),
    notes: z.string().min(1).max(3000),
  }),
]);
export async function POST(req: NextRequest) {
  // Local reviewer console, no real login. Block cross-origin mutations.
  const origin = req.headers.get("origin");
  if (!localReviewerOrigin(origin, req.headers.get("host")))
    return NextResponse.json(
      { error: "Same-origin reviewer request required" },
      { status: 403 },
    );
  try {
    const b = schema.parse(await req.json());
    if (b.type === "review") review(b);
    if (b.type === "dispatch") {
      let n = 0;
      while (await dispatchOne()) {
        if (++n > 100) break;
      }
    }
    if (b.type === "trust") {
      if (!getTenant(b.tenant).approvers.some((a) => a.id === b.actor))
        throw Error("Select a named tenant approver");
      setTrust(
        b.tenant,
        b.next,
        b.actor,
        "Human action in local reviewer console",
      );
    }
    if (b.type === "label") label(b.resultId, b.actor, b.scores, b.notes);
    if (b.type === "retry")
      tx(() => {
        const e = one(
          "SELECT id FROM events WHERE id=? AND tenant=? AND state=?",
          b.eventId,
          b.tenant,
          "dead",
        );
        if (!e) throw Error("Not a dead letter for this tenant");
        db()
          .prepare(
            "UPDATE events SET state='queued',attempts=0,available_at=0,error=NULL WHERE id=?",
          )
          .run(b.eventId);
        audit(b.tenant, b.eventId, "human_requeue", {});
      });
    return NextResponse.json({ ok: true });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Request failed" },
      { status: 409 },
    );
  }
}

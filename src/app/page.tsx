import Link from "next/link";
import { all, one } from "@/lib/db";
import { tenant as getTenant } from "@/lib/catalogue";
import { Draft, money } from "@/lib/domain";
import { Pricing, renderReply } from "@/lib/policy";
import { ActionButton, ReviewControls } from "./components";
export const dynamic = "force-dynamic";
type DraftRow = {
  id: string;
  event_id: string;
  tenant: string;
  body: string;
  pricing: string;
  decision: string;
  status: string;
  source: string;
  reasons: string;
  version: number;
  payload: string;
  created_at: string;
};
export default async function Inbox({
  searchParams,
}: {
  searchParams: Promise<{ tenant?: string; status?: string }>;
}) {
  const params = await searchParams,
    tenantId = params.tenant === "rimal" ? "rimal" : "qamar";
  if (!one("SELECT id FROM tenants LIMIT 1"))
    return (
      <div className="empty">
        <h1>Welcome to Trust Desk</h1>
        <p>
          Run <code>npm run seed</code> to load the supplied seed kit and
          clearly labelled demonstration data.
        </p>
      </div>
    );
  const t = getTenant(tenantId),
    state = one<{ trust: string }>(
      "SELECT trust FROM tenants WHERE id=?",
      tenantId,
    )!.trust;
  const drafts = all<DraftRow>(
    "SELECT d.*,e.payload FROM drafts d JOIN events e ON e.id=d.event_id WHERE d.tenant=? ORDER BY d.rowid DESC",
    tenantId,
  );
  const waiting = drafts.filter((d) =>
    ["needs_approval", "hand_off"].includes(d.status),
  );
  const shown = params.status === "all" ? drafts : waiting;
  const jobs = all<{
    id: string;
    state: string;
    error: string;
    attempts: number;
    payload: string;
  }>("SELECT * FROM events WHERE tenant=? ORDER BY rowid DESC", tenantId);
  const sent = one<{ n: number }>(
    "SELECT count(*) n FROM outbox WHERE tenant=? AND state='sent'",
    tenantId,
  )!.n;
  return (
    <>
      <header>
        <div>
          <div className="eyebrow">OPERATIONS / APPROVALS</div>
          <h1>
            A little oversight.
            <br />
            <span>A lot of confidence.</span>
          </h1>
          <p>Review the evidence. Make the call. Keep the record.</p>
        </div>
        <div className="header-meta">
          <span className="badge">● LIVE DATABASE</span>
          <small>Local delivery sink · no external messages</small>
        </div>
      </header>
      <div className="toolbar">
        <div className="tabs">
          <Link
            className={tenantId === "qamar" ? "active" : ""}
            href="/?tenant=qamar"
          >
            Qamar Devices <small>Dubai · AED</small>
          </Link>
          <Link
            className={tenantId === "rimal" ? "active" : ""}
            href="/?tenant=rimal"
          >
            Rimal Event Supply <small>Riyadh · SAR</small>
          </Link>
        </div>
        <span className="badge amber">{state.toUpperCase()} TRUST</span>
      </div>
      <div className="stats">
        <div>
          <span>Awaiting a decision</span>
          <strong>{waiting.length.toString().padStart(2, "0")}</strong>
          <small>Named human approval</small>
        </div>
        <div>
          <span>Queue / retry</span>
          <strong>
            {jobs
              .filter((j) =>
                ["queued", "retry", "processing"].includes(j.state),
              )
              .length.toString()
              .padStart(2, "0")}
          </strong>
          <small>Durable SQLite jobs</small>
        </div>
        <div>
          <span>Dispatched</span>
          <strong>{sent.toString().padStart(2, "0")}</strong>
          <small>At most once · local sink</small>
        </div>
        <div>
          <span>Policy guardrails</span>
          <strong>
            {t.vat_rate * 100}% <em>VAT</em>
          </strong>
          <small>
            {t.auto_send === "off"
              ? "Every reply needs approval"
              : `Discounts ≥${t.policy.discount_needs_approval_at_pct}% need approval`}
          </small>
        </div>
      </div>
      <div className="section-heading">
        <h2>
          Your review queue <span>{shown.length}</span>
        </h2>
        <div className="actions">
          <Link
            href={`/?tenant=${tenantId}&status=${params.status === "all" ? "pending" : "all"}`}
          >
            {params.status === "all" ? "Show pending" : "Show all records"} ↗
          </Link>
          <ActionButton body={{ type: "dispatch" }}>
            Dispatch approved outbox
          </ActionButton>
        </div>
      </div>
      <div className="notice">
        Demo extractions carry a <b>FIXTURE</b> badge. They are hand-authored
        examples, not real model calls. The API worker records genuine drafts
        separately.
      </div>
      {shown.length === 0 && (
        <div className="empty">
          <h2>You’re all caught up.</h2>
          <p>
            Queued events need the model worker; approved replies appear in the
            audit trail.
          </p>
        </div>
      )}
      {shown.map((row) => {
        const d = JSON.parse(row.body) as Draft,
          p = JSON.parse(row.pricing) as Pricing,
          e = JSON.parse(row.payload);
        const rtl = d.language === "ar";
        return (
          <article className="review-card" key={row.id}>
            <div className="card-top">
              <span
                className={
                  "badge " + (row.status === "hand_off" ? "amber" : "")
                }
              >
                {row.status.replaceAll("_", " ").toUpperCase()}
              </span>
              <span className="badge muted">
                {row.source === "fixture" ? "FIXTURE" : "REAL LLM"}
              </span>
              <span className="channel">
                {e.channel} · {e.event_id} · {d.language.toUpperCase()}
              </span>
            </div>
            <div className="review-grid">
              <section>
                <div className="eyebrow">CUSTOMER MESSAGE</div>
                <p className="customer" dir="auto">
                  {e.text}
                </p>
                <small>{e.from}</small>
                <div className="evidence">
                  <h4>Why this needs a decision</h4>
                  <ul>
                    {(JSON.parse(row.reasons) as string[]).map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                  <h4>Source evidence</h4>
                  {d.evidence.map((s, i) => (
                    <blockquote dir="auto" key={i}>
                      {s}
                    </blockquote>
                  ))}
                  <small>
                    Evidence is model-extracted; compare with the message above.
                  </small>
                </div>
              </section>
              <section>
                <div className="eyebrow">OUTBOUND REPLY · CODE ASSEMBLED</div>
                <pre
                  dir={rtl ? "rtl" : "ltr"}
                  lang={d.language}
                  className="reply"
                >
                  {renderReply(t, d, p, row.decision === "hand_off")}
                </pre>
                <details>
                  <summary>Model draft & pricing evidence</summary>
                  <p dir={rtl ? "rtl" : "ltr"}>{d.reply}</p>
                  <table>
                    <thead>
                      <tr>
                        <th>Catalogue row</th>
                        <th>Qty × periods</th>
                        <th>Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {p.lines.map((l) => (
                        <tr key={l.row_id}>
                          <td>
                            {l.row_id}
                            {l.added ? " + required" : ""}
                          </td>
                          <td>
                            {l.quantity} × {l.periods}
                          </td>
                          <td>{money(l.total, t.currency)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p>
                    Subtotal {money(p.subtotal, t.currency)} · Discount{" "}
                    {money(p.discount, t.currency)} · VAT{" "}
                    {money(p.vat, t.currency)} · Total{" "}
                    <b>{money(p.total, t.currency)}</b>
                  </p>
                </details>
                {["needs_approval", "hand_off"].includes(row.status) && (
                  <ReviewControls
                    tenant={tenantId}
                    draftId={row.id}
                    version={row.version}
                    approvers={t.approvers}
                    reply={renderReply(t, d, p, row.decision === "hand_off")}
                    rtl={rtl}
                  />
                )}
              </section>
            </div>
          </article>
        );
      })}
      <details className="panel">
        <summary>
          Queue health ·{" "}
          {
            jobs.filter((j) =>
              ["retry", "dead", "processing"].includes(j.state),
            ).length
          }{" "}
          jobs need attention
        </summary>
        {jobs.map((j) => (
          <div className="job" key={j.id}>
            <span className="badge">{j.state}</span>{" "}
            {JSON.parse(j.payload).event_id} · attempt {j.attempts}{" "}
            <span className="error">{j.error}</span>
            {j.state === "dead" && (
              <ActionButton
                body={{ type: "retry", tenant: tenantId, eventId: j.id }}
              >
                Requeue dead letter
              </ActionButton>
            )}
          </div>
        ))}
      </details>
    </>
  );
}

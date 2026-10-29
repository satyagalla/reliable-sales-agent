import {
  Draft,
  Tenant,
  Price,
  Trust,
  Decision,
  minor,
  money,
  normalize,
} from "./domain";
export type Pricing = {
  lines: {
    row_id: string;
    quantity: number;
    periods: number;
    unit: number;
    total: number;
    added: boolean;
  }[];
  subtotal: number;
  discount: number;
  net: number;
  vat: number;
  total: number;
  currency: string;
};
export function priceDraft(t: Tenant, rows: Price[], draft: Draft): Pricing {
  const requested = draft.lines.map((l) => ({ ...l, added: false }));
  const add = (row_id: string) => {
    if (!requested.some((l) => l.row_id === row_id))
      requested.push({
        row_id,
        quantity: 1,
        periods: 1,
        mode: "service",
        added: true,
      });
  };
  if (
    t.id === "qamar" &&
    requested.some((l) => l.mode === "rent" || l.mode === "buy")
  )
    add("Q-SVC-001");
  if (
    t.id === "rimal" &&
    requested.some(
      (l) =>
        l.row_id === "R-TNT-001" ||
        (l.row_id === "R-STG-001" && l.quantity * 2 > 12) ||
        (l.row_id === "R-LED-001" && l.quantity > 6),
    )
  )
    add("R-CRW-001");
  const seen = new Set<string>();
  const lines = requested.map((l) => {
    if (seen.has(l.row_id)) throw Error("Duplicate catalogue row");
    seen.add(l.row_id);
    const row = rows.find((r) => r.id === l.row_id);
    if (!row) throw Error("Unknown or foreign catalogue row: " + l.row_id);
    let amount: number | undefined;
    if (row.flat !== undefined || row.per_shift !== undefined) {
      if (l.mode !== "service" || l.periods !== 1 || l.quantity !== 1)
        throw Error("Service charged once per order");
      amount = row.flat ?? row.per_shift;
    } else if (t.id === "qamar") {
      if (l.mode === "buy" && l.periods !== 1)
        throw Error("Purchase cannot repeat");
      amount =
        l.mode === "buy"
          ? row.buy
          : l.mode === "rent"
            ? row.rent_per_month
            : undefined;
    } else amount = l.mode === "rent" ? row.per_day : undefined;
    if (amount === undefined) throw Error("Unsupported price basis");
    const unit = minor(amount),
      total = unit * l.quantity * l.periods;
    if (!Number.isSafeInteger(total)) throw Error("Money overflow");
    return { ...l, unit, total };
  });
  const subtotal = lines.reduce((n, l) => n + l.total, 0),
    discount = Math.floor((subtotal * draft.discount_pct + 50) / 100),
    net = subtotal - discount;
  const vatBps = Math.round(t.vat_rate * 10000),
    vat = Math.floor((net * vatBps + 5000) / 10000);
  if (!Number.isSafeInteger(net + vat)) throw Error("Money overflow");
  return {
    lines,
    subtotal,
    discount,
    net,
    vat,
    total: net + vat,
    currency: t.currency,
  };
}
export function decide(
  t: Tenant,
  d: Draft,
  p: Pricing,
  state: Trust,
  customerText = "",
): { decision: Decision; reasons: string[] } {
  const text = normalize(customerText).toLowerCase(),
    city = normalize(d.city).trim().toLowerCase();
  if (d.intent === "spam")
    return { decision: "drop", reasons: ["Spam classified; never dispatched"] };
  if (
    /system override|ignore.*instructions|admin mode|print.*instructions|تجاهل.*تعليمات/.test(
      text,
    )
  )
    return {
      decision: "hand_off",
      reasons: ["Prompt injection marker in untrusted input"],
    };
  if (d.intent === "support" || d.intent === "unknown" || d.risk === "high")
    return {
      decision: "hand_off",
      reasons: ["Support, unsupported request, or high risk"],
    };
  const aliases: Record<string, string> = {
    دبي: "dubai",
    الشارقة: "sharjah",
    الرياض: "riyadh",
    jlt: "dubai",
    الملقا: "riyadh",
  };
  if (
    city &&
    !t.policy.service_area.some(
      (c) => c.toLowerCase() === (aliases[city] || city),
    )
  )
    return {
      decision: "hand_off",
      reasons: ["Outside service area: " + d.city],
    };
  if (/abu dhabi|أبوظبي|أبو ظبي|jeddah|جدة|dammam|الدمام/.test(text))
    return {
      decision: "hand_off",
      reasons: ["Outside service area in source message"],
    };
  if (
    t.id === "qamar" &&
    d.lines.some((l) => l.mode === "rent" && l.periods > 12)
  )
    return {
      decision: "hand_off",
      reasons: ["Rentals over twelve months require general manager"],
    };
  if (p.lines.length && p.net < minor(t.policy.minimum_order_before_vat || 0))
    return {
      decision: "hand_off",
      reasons: ["Below minimum order before VAT"],
    };
  const reasons: string[] = [];
  if (d.discount_pct >= t.policy.discount_needs_approval_at_pct)
    reasons.push("Discount meets approval threshold");
  if (d.discount_pct > 0) reasons.push("Discount commitment needs approval");
  if (d.commitments.length)
    reasons.push("Commitments need approval: " + d.commitments.join(", "));
  if (d.intent === "quote" || d.lines.length)
    reasons.push(
      "Quote requires human verification of extracted quantities and terms",
    );
  if (d.missing.length)
    reasons.push("Missing information: " + d.missing.join(", "));
  if (d.risk !== "low") reasons.push("Risk is not low");
  if (state !== "autonomous") reasons.push("Tenant trust is supervised");
  if (t.auto_send !== "low_risk_only")
    reasons.push("Tenant auto-send is disabled");
  if (d.intent !== "faq")
    reasons.push("Only catalogue FAQ responses qualify for autonomous sending");
  return {
    decision: reasons.length ? "needs_approval" : "auto_send",
    reasons: reasons.length
      ? reasons
      : ["Low-risk FAQ, tenant opted in, autonomous trust"],
  };
}
// Outbound copy is assembled from approved facts, never model-authored promises or amounts.
export function renderReply(
  t: Tenant,
  d: Draft,
  p: Pricing,
  handoff = false,
): string {
  const ar = d.language === "ar";
  if (handoff)
    return ar
      ? "شكرًا لتواصلكم. يتطلب طلبكم مراجعة بشرية. سيقوم فريقنا بمراجعة نطاق الخدمة والمتطلبات قبل تقديم عرض أو تأكيد أي التزام."
      : "Thank you for contacting us. Your request requires human review. Our team will check the service area and requirements before providing a quote or confirming any commitment.";
  if (d.intent === "faq" && !p.lines.length) {
    const arabic =
      t.id === "qamar"
        ? [
            "الأسعار تشمل تغطية الضرر العرضي ولا تشمل السرقة.",
            "يلزم تقديم نسخة من الرخصة التجارية قبل التسليم.",
            "الحد الأدنى للإيجار شهر واحد. الإيجار لأكثر من 12 شهرًا يحتاج مراجعة المدير العام.",
            "رسوم التوصيل والتركيب تفرض مرة واحدة لكل طلب.",
          ]
        : [
            "الأسعار لكل يوم فعالية.",
            "يلزم طاقم تركيب للمسارح الأكبر من 12 مترًا مربعًا والشاشات الأكبر من 6 أمتار مربعة وجميع الخيام.",
            "دفعة مقدمة 30% تؤكد الحجز. مدير العمليات وحده يؤكد التوفر.",
            "الحد الأدنى للطلب 2,000 ريال قبل الضريبة.",
          ];
    return (ar ? arabic : t.faq).join("\n");
  }
  if (!p.lines.length)
    return ar
      ? "شكرًا لتواصلكم. تمت إحالة طلبكم إلى فريقنا للمراجعة. لم يتم تأكيد أي حجز أو تسليم."
      : "Thank you for contacting us. Your request has been referred to our team for review. No booking or delivery has been confirmed.";
  const items = p.lines
    .map(
      (l) =>
        `${l.row_id} × ${l.quantity} × ${l.periods}: ${money(l.total, t.currency, d.language)}`,
    )
    .join("\n");
  return [
    ar
      ? "عرض سعر مبدئي، رهن التحقق من المتطلبات والتوفر."
      : "Indicative quote, subject to verification of requirements and availability.",
    items,
    `${ar ? "المجموع قبل الخصم" : "Subtotal"}: ${money(p.subtotal, t.currency, d.language)}`,
    `${ar ? "الخصم" : "Discount"}: ${money(p.discount, t.currency, d.language)}`,
    `${ar ? "ضريبة القيمة المضافة" : "VAT"} (${t.vat_rate * 100}%): ${money(p.vat, t.currency, d.language)}`,
    `${ar ? "الإجمالي" : "Total"}: ${money(p.total, t.currency, d.language)}`,
    d.missing.length
      ? ar
        ? "يرجى توضيح المعلومات الناقصة مع الفريق قبل تأكيد العرض."
        : "Please clarify with our team: " + d.missing.join("; ")
      : null,
    ar
      ? "هذا العرض لا يؤكد الحجز أو التسليم."
      : "This quote does not confirm booking or delivery.",
  ]
    .filter(Boolean)
    .join("\n");
}

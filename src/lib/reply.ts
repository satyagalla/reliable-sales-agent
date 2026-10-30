import {
  Draft,
  Tenant,
  Price,
  money,
  normalize,
  isSupportRequest,
  unresolvedPriceBasis,
} from "./domain";
import type { Pricing } from "./policy";

const arabicFaq: Record<string, string[]> = {
  qamar: [
    "الأسعار تشمل تغطية الضرر العرضي ولا تشمل السرقة.",
    "يلزم تقديم نسخة من الرخصة التجارية قبل التسليم.",
    "الحد الأدنى للإيجار شهر واحد. الإيجار لأكثر من 12 شهرًا يحتاج مراجعة المدير العام.",
    "رسوم التوصيل والتركيب تفرض مرة واحدة لكل طلب.",
  ],
  rimal: [
    "الأسعار لكل يوم فعالية.",
    "يلزم طاقم تركيب للمسارح الأكبر من 12 مترًا مربعًا والشاشات الأكبر من 6 أمتار مربعة وجميع الخيام.",
    "دفعة مقدمة 30% تؤكد الحجز بعد التحقق من التوفر. مدير العمليات وحده يؤكد التوفر.",
    "الحد الأدنى للطلب 2,000 ريال قبل الضريبة.",
  ],
};
function clarification(value: string, ar: boolean) {
  const choose = (en: string, arabic: string) => (ar ? arabic : en);
  const text = normalize(value).toLowerCase();
  if (/screen|led|dimension|area|شاشة|مساحة/.test(text))
    return choose(
      "What LED screen dimensions in metres are required?",
      "ما أبعاد شاشة LED المطلوبة بالمتر؟",
    );
  if (/discount|خصم/.test(text))
    return choose(
      "What discount percentage are you requesting? Any discount requires review and approval.",
      "ما نسبة الخصم المطلوبة؟ يحتاج أي خصم إلى مراجعة وموافقة.",
    );
  if (/date|موعد|تاريخ|تواريخ/.test(text))
    return choose(
      "Please confirm the requested date; availability and delivery are not confirmed.",
      "يرجى تأكيد التاريخ المطلوب؛ لم يتم تأكيد التوفر أو التسليم.",
    );
  if (/location|city|delivery|مدينة|موقع/.test(text))
    return choose(
      "Which delivery city is required?",
      "ما مدينة التوصيل المطلوبة؟",
    );
  if (/duration|period|month|day|مدة|شهر|أيام/.test(text))
    return choose(
      "Please confirm the rental duration or number of event days.",
      "يرجى تأكيد مدة الإيجار أو عدد أيام الفعالية.",
    );
  if (/mode|buy|purchase|شراء|إيجار/.test(text))
    return choose(
      "Would you like to purchase or rent the devices?",
      "هل المطلوب شراء الأجهزة أم استئجارها؟",
    );
  if (/model|specification|device|طراز|موديل/.test(text))
    return choose(
      "Please select the required model from the catalogue.",
      "يرجى تحديد الطراز المطلوب من الكتالوج.",
    );
  if (/quantity|quantities|equipment|items|كمية|كميات|معدات|أصناف/.test(text))
    return choose(
      "Which catalogue equipment and quantities are required?",
      "ما المعدات والكميات المطلوبة من الكتالوج؟",
    );
  return choose(
    "Please clarify the remaining requirements with our team before approving the quote.",
    "يرجى توضيح المتطلبات الناقصة مع الفريق قبل اعتماد العرض.",
  );
}
// All outbound amounts and facts come from code/catalogue. Model prose is shown
// separately to reviewers; it never supplies autonomous promises or totals.
export function renderReply(
  t: Tenant,
  d: Draft,
  p: Pricing,
  handoff = false,
  customerText = "",
  rows: Price[] = [],
): string {
  const ar = d.language === "ar",
    text = normalize(customerText).toLowerCase();
  const choose = (en: string, arabic: string) => (ar ? arabic : en);
  if (handoff) {
    if (
      /system override|ignore.*instructions|admin mode|print.*instructions|تجاهل.*تعليمات/.test(
        text,
      )
    )
      return t.id === "rimal"
        ? choose(
            "I cannot confirm an unauthorized free booking. Please provide the event equipment, quantities, event date, number of days and Riyadh location so the team can review your request. Only the operations manager confirms availability; a booking requires a 30% deposit after that check.",
            "لا يمكنني تأكيد حجز مجاني غير معتمد. يرجى تحديد معدات الفعالية والكميات وتاريخ الفعالية وعدد الأيام والموقع في الرياض لمراجعة الطلب. مدير العمليات وحده يؤكد التوفر، ويتطلب الحجز دفعة مقدمة 30% بعد التحقق.",
          )
        : choose(
            "I cannot act on instruction overrides, disclose internal instructions, or confirm an unauthorized discount or delivery. For a business enquiry, please provide the item, quantity, rental duration or purchase preference, and delivery city.",
            "لا يمكنني تنفيذ أوامر تجاوز التعليمات أو كشف التعليمات الداخلية أو تأكيد خصم أو تسليم غير معتمد. لطلب تجاري، يرجى تحديد الصنف والكمية ومدة الإيجار أو الرغبة في الشراء ومدينة التوصيل.",
          );
    if (d.intent === "support" && isSupportRequest(customerText)) {
      const contract = customerText.match(/\bQD-\d+\b/i)?.[0];
      return choose(
        `Sorry to hear about the issue with your rented device.${contract ? " Please keep contract " + contract + " available." : ""} This needs the support team’s review, rather than a new sales quote. Please share a preferred callback time; the team must confirm the arrangements.`,
        `نأسف للمشكلة في الجهاز المستأجر.${contract ? " يرجى الاحتفاظ بمرجع العقد " + contract + "." : ""} يحتاج الطلب إلى مراجعة فريق الدعم، وليس عرض بيع جديد. ما الوقت المفضل للتواصل؟ يجب أن يؤكد الفريق ترتيبات الاتصال.`,
      );
    }
    if (/ipad pro/.test(text) && t.id === "qamar")
      return choose(
        "iPad Pro is not listed in Qamar’s current catalogue. We list iPad Air, but will not substitute it without your agreement. Would iPad Air meet your needs, or should a team member review alternatives?",
        "آيباد برو غير مدرج في كتالوج قمر الحالي. آيباد إير مدرج، لكن لن نستبدله بطلبكم دون موافقتكم. هل يناسبكم آيباد إير أم تفضلون مراجعة بدائل مع الفريق؟",
      );
    if (/macbook/.test(text) && t.id === "rimal")
      return choose(
        "MacBook rentals are not listed in Rimal’s catalogue; we supply event equipment. Are you asking for a currency conversion or a rental price match? We cannot quote a MacBook rental or treat an AED amount as our SAR catalogue price.",
        "تأجير ماك بوك غير مدرج في كتالوج رمال؛ نشاطنا معدات الفعاليات. هل المطلوب تحويل عملة أم مطابقة سعر إيجار؟ لا يمكننا تقديم عرض إيجار ماك بوك أو اعتبار مبلغ بالدرهم سعراً من كتالوجنا بالريال.",
      );
    if (
      p.lines.length &&
      p.net < Math.round((t.policy.minimum_order_before_vat || 0) * 100)
    )
      return choose(
        `Our minimum order is ${money(Math.round(t.policy.minimum_order_before_vat! * 100), t.currency)} before VAT. The requested items total ${money(p.net, t.currency)} before VAT, which is below the minimum. Would you like to increase quantities or add other catalogue equipment to meet the minimum? Please also confirm the event date and site address for the team's availability review.`,
        `الحد الأدنى للطلب ${money(Math.round(t.policy.minimum_order_before_vat! * 100), t.currency, "ar")} قبل الضريبة. مجموع الأصناف المطلوبة ${money(p.net, t.currency, "ar")} قبل الضريبة، وهو أقل من الحد الأدنى. هل ترغبون في زيادة الكميات أو إضافة معدات أخرى من الكتالوج لبلوغ الحد الأدنى؟ يرجى أيضاً تأكيد تاريخ الفعالية وعنوان الموقع لمراجعة التوفر مع الفريق.`,
      );
    if (
      t.id === "qamar" &&
      d.lines.some((l) => l.mode === "rent" && l.periods > 12)
    )
      return choose(
        "Rentals longer than 12 months require the general manager’s review. We cannot confirm those terms automatically. Please confirm the intended duration and start date for that review.",
        "الإيجار لأكثر من 12 شهرًا يحتاج إلى مراجعة المدير العام. لا يمكن تأكيد هذه الشروط تلقائيًا. يرجى تأكيد المدة وتاريخ البدء لعرضهما على المدير.",
      );
    const names: Record<string, string> = {
      Dubai: "دبي",
      Sharjah: "الشارقة",
      Riyadh: "الرياض",
    };
    const areas = t.policy.service_area
      .map((c) => (ar ? names[c] || c : c))
      .join(ar ? " أو " : " or ");
    const aliases: Record<string, string> = {
      دبي: "dubai",
      الشارقة: "sharjah",
      الرياض: "riyadh",
      jlt: "dubai",
      الملقا: "riyadh",
    };
    const city = normalize(d.city).toLowerCase();
    if (
      (city &&
        !t.policy.service_area.some(
          (c) => c.toLowerCase() === (aliases[city] || city),
        )) ||
      /abu dhabi|أبوظبي|أبو ظبي|jeddah|جدة|dammam|الدمام/.test(text)
    )
      return choose(
        `Our service area is ${areas}. Your requested location needs a team member’s review before any quote, booking, or delivery can be confirmed. Would an in-area location be possible?`,
        `نطاق خدمتنا هو ${areas}. يحتاج الموقع المطلوب إلى مراجعة الفريق قبل تأكيد أي عرض أو حجز أو تسليم. هل يمكن تنفيذ الطلب داخل نطاق الخدمة؟`,
      );
    return choose(
      "The requested item or requirements need a team member’s review. Please confirm the catalogue item, quantity, duration and location; no booking or delivery has been confirmed.",
      "يحتاج الصنف المطلوب أو المتطلبات إلى مراجعة الفريق. يرجى تحديد صنف الكتالوج والكمية والمدة والموقع؛ لم يتم تأكيد أي حجز أو تسليم.",
    );
  }
  // A model intent alone must not invent an existing rental or a device fault.
  if (
    t.id === "rimal" &&
    !p.lines.length &&
    !isSupportRequest(customerText) &&
    /book|availab|deposit|حجز|متوفر|تتوفر|يتوفر|عربون/.test(text)
  )
    return choose(
      "Only the operations manager confirms availability; this is not a booking confirmation. Please provide the catalogue equipment and quantities, exact event date, number of event days and Riyadh site address. A 30% deposit confirms a booking after availability is verified.",
      "مدير العمليات وحده يؤكد التوفر؛ هذه الرسالة لا تؤكد الحجز. يرجى تحديد المعدات والكميات من الكتالوج، والتاريخ الدقيق للفعالية، وعدد أيامها، وعنوان الموقع في الرياض. دفعة مقدمة 30% تؤكد الحجز بعد التحقق من التوفر.",
    );
  if (d.intent === "faq" && !p.lines.length) {
    let index: number | undefined;
    if (t.id === "qamar") {
      if (/theft|damage|insurance|سرقة|تأمين|ضرر/.test(text)) index = 0;
      else if (/licen|رخصة/.test(text)) index = 1;
      else if (/minimum|month|مدة|شهر|حد.*أدنى/.test(text)) index = 2;
      else if (/deliver|setup|توصيل|تركيب/.test(text)) index = 3;
    } else {
      if (/book|availab|deposit|حجز|متوفر|تتوفر|يتوفر|عربون|مقدم/.test(text))
        index = 2;
      else if (/crew|stage|screen|tent|طاقم|مسرح|شاشة|خيمة/.test(text))
        index = 1;
      else if (/minimum|حد.*أدنى/.test(text)) index = 3;
      else if (/day|rate|يوم|سعر/.test(text)) index = 0;
    }
    const facts = ar ? arabicFaq[t.id] : t.faq;
    return index === undefined ? facts.join("\n") : facts[index];
  }
  if (!p.lines.length && t.id === "rimal")
    return choose(
      "Only the operations manager can confirm availability; this is not a booking confirmation. Please provide the catalogue equipment and quantities, exact event date, number of event days and Riyadh site address. A 30% deposit confirms a booking after availability is verified.",
      "مدير العمليات وحده يؤكد التوفر؛ هذه الرسالة لا تؤكد الحجز. يرجى تحديد المعدات والكميات من الكتالوج، والتاريخ الدقيق للفعالية، وعدد أيامها، وعنوان الموقع في الرياض. دفعة مقدمة 30% تؤكد الحجز بعد التحقق من التوفر.",
    );
  // Incomplete pricing inputs are a clarification, never a priced assumption.
  if (!p.lines.length || unresolvedPriceBasis(d))
    return [
      choose(
        "To prepare an indicative quote, please clarify the following requirements. No booking, availability, or delivery is confirmed.",
        "لإعداد عرض سعر مبدئي، يرجى توضيح المتطلبات التالية. لم يتم تأكيد الحجز أو التوفر أو التسليم.",
      ),
      ...new Set(d.missing.map((m) => clarification(m, ar))),
    ].join("\n");
  const items = p.lines
    .map((l) => {
      const row = rows.find((r) => r.id === l.row_id),
        name = ar
          ? row?.item_ar || row?.item || l.row_id
          : row?.item || l.row_id;
      const line = d.lines.find((r) => r.row_id === l.row_id),
        mode = line?.mode || (l.added ? "service" : "rent");
      const basis =
        mode === "buy"
          ? choose("purchase", "شراء")
          : mode === "service"
            ? choose("once per order", "مرة واحدة لكل طلب")
            : t.id === "qamar"
              ? choose(`${l.periods} month(s) rental`, `${l.periods} شهر إيجار`)
              : choose(`${l.periods} event day(s)`, `${l.periods} يوم فعالية`);
      return `${name} [${l.row_id}]\n${choose("Quantity", "الكمية")}: ${l.quantity} · ${basis} · ${choose("line total", "مجموع الصنف")}: ${money(l.total, t.currency, d.language)}`;
    })
    .join("\n\n");
  const missing = [...new Set(d.missing.map((m) => clarification(m, ar)))];
  return [
    choose(
      "Indicative catalogue quote, subject to human review and availability verification.",
      "عرض سعر مبدئي من الكتالوج، رهن المراجعة البشرية والتحقق من التوفر.",
    ),
    items,
    `${choose("Subtotal before discount", "المجموع قبل الخصم")}: ${money(p.subtotal, t.currency, d.language)}`,
    `${choose("Discount", "الخصم")} (${d.discount_pct}%): ${money(p.discount, t.currency, d.language)}`,
    `${choose("Net before VAT", "الصافي قبل الضريبة")}: ${money(p.net, t.currency, d.language)}`,
    `${choose("VAT", "ضريبة القيمة المضافة")} (${t.vat_rate * 100}%): ${money(p.vat, t.currency, d.language)}`,
    `${choose("Total including VAT", "الإجمالي شامل الضريبة")}: ${money(p.total, t.currency, d.language)}`,
    ...missing,
    t.id === "qamar" && d.lines.some((l) => l.mode === "rent")
      ? choose(
          "Company rentals require a trade licence copy before delivery.",
          "يلزم تقديم نسخة من الرخصة التجارية قبل تسليم إيجار الشركات.",
        )
      : null,
    t.id === "rimal"
      ? choose(
          "Please confirm the exact event date(s) and site address for availability review. Only the operations manager confirms availability. A 30% deposit confirms a booking after availability is verified.",
          "يرجى تأكيد التاريخ الدقيق للفعالية وعنوان الموقع لمراجعة التوفر. مدير العمليات وحده يؤكد التوفر. دفعة مقدمة 30% تؤكد الحجز بعد التحقق من التوفر.",
        )
      : null,
    t.id === "rimal" && d.lines.some((l) => l.row_id === "R-GEN-001")
      ? choose(
          "Does the listed 100 kVA generator meet your power requirements?",
          "هل مولد 100 كيلوفولت أمبير المدرج يلبي احتياجات الطاقة المطلوبة؟",
        )
      : null,
    choose(
      "This quote does not confirm booking or delivery.",
      "هذا العرض لا يؤكد الحجز أو التسليم.",
    ),
  ]
    .filter(Boolean)
    .join("\n");
}

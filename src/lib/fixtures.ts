import { Draft } from "./domain";
// Hand-authored demonstration extractions, never represented as model outputs.
export function fixture(eventId: string): Draft {
  const base: Draft = {
    language: "en",
    intent: "quote",
    lines: [],
    discount_pct: 0,
    city: "",
    commitments: [],
    risk: "medium",
    missing: [],
    reply:
      "Thank you. We will verify the requirements before confirming a quote.",
    evidence: [],
  };
  const line = (
    row_id: string,
    quantity: number,
    periods = 1,
    mode: "rent" | "buy" | "service" = "rent",
  ) => ({ row_id, quantity, periods, mode });
  const cases: Record<string, Partial<Draft>> = {
    evt_0001: {
      lines: [line("Q-LAP-001", 25, 3)],
      missing: ["Requested volume discount", "Delivery location"],
      evidence: ["25 MacBook Airs", "3 month"],
    },
    evt_0002: {
      language: "ar",
      lines: [line("Q-PHN-001", 5, 1, "buy")],
      missing: ["Delivery location"],
      reply: "شكرًا لتواصلكم. هذا عرض مبدئي رهن التحقق من المتطلبات والتوفر.",
      evidence: ["٥ آيفون 16", "شراء مو إيجار"],
    },
    evt_0003: {
      lines: [line("Q-LAP-001", 30, 3)],
      city: "Dubai",
      missing: ["Requested volume discount"],
      evidence: ["make that 30", "JLT", "3 month from previous message"],
    },
    evt_0005: {
      lines: [line("Q-LAP-002", 12, 6), line("Q-MON-001", 12, 6)],
      city: "Abu Dhabi",
      commitments: ["delivery"],
      missing: ["Exact laptop model"],
      evidence: ["Abu Dhabi office", "delivered by 15 Nov"],
    },
    evt_0006: {
      intent: "unknown",
      risk: "high",
      missing: ["Malicious instruction attempt"],
      evidence: ["SYSTEM OVERRIDE"],
    },
    evt_0007: {
      language: "ar",
      intent: "unknown",
      risk: "high",
      missing: ["iPad Pro not in catalogue"],
      reply: "هل تقصدون آيباد إير؟ آيباد برو غير مدرج في الكتالوج.",
      evidence: ["ipad pro"],
    },
    evt_0008: {
      language: "ar",
      lines: [
        line("R-CHR-001", 300),
        line("R-TBL-001", 30),
        line("R-STG-001", 12),
      ],
      city: "Riyadh",
      commitments: ["availability"],
      missing: ["LED screen area"],
      reply: "يرجى تحديد مساحة الشاشة. سيتحقق مدير العمليات من التوفر.",
      evidence: ["٣٠٠ كرسي", "٣٠ طاولة", "مسرح ٦×٤ متر"],
    },
    evt_0009: {
      lines: [line("R-LED-001", 12, 2), line("R-MIC-001", 2, 2)],
      missing: ["Delivery location"],
      evidence: ["4m x 3m for 2 days", "2 wireless mics"],
    },
    evt_0010: {
      intent: "unknown",
      risk: "high",
      missing: ["MacBook unavailable in Rimal catalogue"],
      evidence: ["MacBook Airs", "Dubai partner"],
    },
    evt_0011: {
      language: "ar",
      lines: [line("R-TNT-001", 1, 3)],
      city: "Riyadh",
      reply:
        "عرض سعر مبدئي للخيمة لمدة ثلاثة أيام. التوفر يحتاج تأكيد مدير العمليات.",
      evidence: ["خيمة 10×20", "ثلاث أيام", "حي الملقا"],
    },
    evt_0012: {
      intent: "support",
      risk: "high",
      evidence: ["screen keeps flickering", "QD-2291"],
    },
    evt_0013: {
      intent: "spam",
      risk: "high",
      evidence: ["advertising credit", "Claim within 24h"],
    },
  };
  return { ...base, ...cases[eventId] };
}

import { z } from "zod";

export const eventSchema = z.object({
  event_id: z.string().min(1).max(200),
  channel: z.enum(["whatsapp", "email", "webform"]),
  to: z.string().min(1).max(200),
  from: z.string().min(1).max(200),
  message_id: z.string().min(1).max(200),
  sent_at: z.string().datetime({ offset: true }),
  received_at: z.string().datetime({ offset: true }),
  text: z.string().min(1).max(20000),
  metadata: z.record(z.unknown()).optional(),
});
export type ChannelEvent = z.infer<typeof eventSchema>;
export const draftSchema = z
  .object({
    language: z.enum(["en", "ar"]),
    intent: z.enum(["quote", "faq", "support", "spam", "unknown"]),
    lines: z
      .array(
        z
          .object({
            row_id: z.string().min(1),
            quantity: z.number().int().min(1).max(10000),
            periods: z.number().int().min(1).max(365),
            mode: z.enum(["buy", "rent", "service"]),
          })
          .strict(),
      )
      .max(30),
    discount_pct: z.number().int().min(0).max(100),
    city: z.string().max(100),
    commitments: z.array(
      z.enum(["availability", "delivery", "booking", "discount"]),
    ),
    risk: z.enum(["low", "medium", "high"]),
    missing: z.array(z.string().max(200)).max(10),
    reply: z.string().min(1).max(5000),
    evidence: z.array(z.string().max(300)).max(20),
  })
  .strict();
export type Draft = z.infer<typeof draftSchema>;
export type Tenant = {
  id: string;
  name: string;
  currency: string;
  vat_rate: number;
  languages: string[];
  auto_send: string;
  channels: { channel: string; address: string }[];
  approvers: { id: string; name: string; role: string }[];
  policy: {
    discount_needs_approval_at_pct: number;
    service_area: string[];
    minimum_order_before_vat?: number;
  };
  faq: string[];
};
export type Price = {
  id: string;
  item: string;
  item_ar?: string;
  rent_per_month?: number;
  buy?: number;
  flat?: number;
  per_day?: number;
  per_shift?: number;
};
export type Decision = "auto_send" | "needs_approval" | "hand_off" | "drop";
export type Trust = "supervised" | "autonomous";
export function normalize(text: string) {
  return text
    .normalize("NFKC")
    .replace(/[٠-٩]/g, (c) => String(c.charCodeAt(0) - 1632))
    .replace(/[۰-۹]/g, (c) => String(c.charCodeAt(0) - 1776))
    .replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "");
}
export function minor(value: number): number {
  const n = Math.round(value * 100);
  if (!Number.isSafeInteger(n) || n < 0) throw Error("Invalid money");
  return n;
}
export function money(value: number, currency: string, language = "en") {
  return new Intl.NumberFormat(language === "ar" ? "ar-AE" : "en-GB", {
    style: "currency",
    currency,
  }).format(value / 100);
}

import { z } from "zod";

export const NextPhotoRequestSchema = z.object({
  instruction: z.string().describe("The single most useful next photo to take, phrased as an instruction to the user"),
  reason: z.string().describe("Why this photo would materially improve identification or pricing confidence"),
});

export const ConditionSchema = z.enum([
  "new_sealed",
  "like_new",
  "excellent",
  "good",
  "fair",
  "poor",
  "for_parts",
  "unknown",
]);

export const PriceTypeSchema = z.enum(["retail_new", "marketplace_asking", "confirmed_sold"]);

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export const PriceSourceSchema = z.object({
  title: z.string(),
  url: z.string().refine(isHttpUrl, { message: "url must be an absolute http(s) link" }),
  // A negative source price isn't a real observation — reject it here
  // rather than only at the composite level, so it can never slip through
  // as "evidence" for a positive valuation (project.md D1).
  price: z.number().nonnegative().nullable(),
  currency: z.string(),
  price_type: PriceTypeSchema.describe(
    "retail_new = current new/retail price. marketplace_asking = an active listing or marketplace price (use this for almost everything, including StockX/eBay/Vinted/Poshmark current prices). confirmed_sold = only a page that explicitly documents a completed sale — rare, and never the default guess.",
  ),
});

// market_evidence = at least one number came from an actual search result.
// general_estimate = no specific-enough hypothesis to search, or the search
// found nothing usable — the price instead reflects general knowledge of
// what similar items (category/material/style) typically go for. Explicit,
// porteur-requested tradeoff (2026-09-17): Valyo should still offer a
// rough number in this case rather than refuse outright, as long as it's
// never presented as if it were the market_evidence case.
export const PriceBasisSchema = z.enum(["market_evidence", "general_estimate", "unavailable"]);

const BaseObjectAnalysisSchema = z.object({
  category: z.string().describe("A short free-text category for the item, e.g. lego, electronics, sneakers, jewelry, furniture — not limited to a fixed list"),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  variant: z.string().nullable(),
  identifying_marks: z.array(z.string()).describe("Visible text, reference numbers, set numbers, or logos that support the identification"),

  identification_confidence: z.number().min(0).max(1),

  condition: ConditionSchema,
  condition_confidence: z.number().min(0).max(1),

  missing_information: z.array(z.string()),
  next_photo_request: NextPhotoRequestSchema.nullable(),

  currency: z.string().describe("ISO currency code, e.g. EUR"),
  retail_price_new: z.number().nullable().describe("Current new/retail price if known, from web search"),
  estimated_value_low: z.number().nullable().describe("Low end of the second-hand value estimate"),
  estimated_value_high: z.number().nullable().describe("High end of the second-hand value estimate"),
  price_confidence: z.number().min(0).max(1),
  price_basis: PriceBasisSchema,
  price_sources: z.array(PriceSourceSchema),

  reasoning_summary: z.array(z.string()).describe("Short bullet points explaining the valuation, for the 'Why this price?' UI section"),
});

const NUMERIC_PRICE_FIELDS = ["retail_price_new", "estimated_value_low", "estimated_value_high"] as const;

// A published price is a claim that needs *some* honest basis. These
// invariants exist because nothing upstream (prompting alone) reliably
// stops a priced result with no supporting basis, or a reversed/negative
// range, from reaching the UI — see project.md R1.
export const ObjectAnalysisSchema = BaseObjectAnalysisSchema.superRefine((data, ctx) => {
  for (const field of NUMERIC_PRICE_FIELDS) {
    const value = data[field];
    if (value !== null && value < 0) {
      ctx.addIssue({ code: "custom", path: [field], message: `${field} cannot be negative` });
    }
  }

  if (
    data.estimated_value_low !== null &&
    data.estimated_value_high !== null &&
    data.estimated_value_low > data.estimated_value_high
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["estimated_value_low"],
      message: "estimated_value_low cannot exceed estimated_value_high",
    });
  }

  const hasAnyPrice = NUMERIC_PRICE_FIELDS.some((field) => data[field] !== null);

  if (data.price_basis === "market_evidence") {
    // A source with url+title but price: null is a citation, not an
    // observation — it cannot be the evidence behind a published number
    // (project.md C1, following R1).
    const hasObservedPrice = data.price_sources.some((source) => source.price !== null);
    if (hasAnyPrice && !hasObservedPrice) {
      ctx.addIssue({
        code: "custom",
        path: ["price_sources"],
        message: "a market_evidence result must cite at least one source with an observed numeric price",
      });
    }
  } else if (data.price_basis === "general_estimate") {
    // No search-backed source required, but the model must actually explain
    // itself — a bare number with no stated reasoning is exactly the
    // fabrication risk this whole schema exists to prevent. A whitespace-only
    // entry is the same as no explanation at all.
    const hasNonBlankReasoning = data.reasoning_summary.some((line) => line.trim().length > 0);
    if (hasAnyPrice && !hasNonBlankReasoning) {
      ctx.addIssue({
        code: "custom",
        path: ["reasoning_summary"],
        message: "a general_estimate price must explain what general knowledge it's based on",
      });
    }
    // Choosing GENERAL_ESTIMATE is itself a claim that a rough number is
    // possible — reasoning that concludes "worth little/nothing" without
    // ever stating that as a number (e.g. a near-zero range) is the same
    // refusal UNAVAILABLE exists for, just dressed up as an estimate. This
    // was observed in practice: a used, nearly-empty water bottle got full
    // "no resale value" reasoning but null price fields, rendering as "no
    // price available" in the UI as if nothing could be said at all.
    if (!hasAnyPrice) {
      ctx.addIssue({
        code: "custom",
        path: ["estimated_value_low"],
        message:
          "a general_estimate must give an actual number, even a near-zero one (e.g. 0-1) — if the object is genuinely worth almost nothing, say so as a number, don't leave the price fields empty",
      });
    }
    // price_basis is a single field covering the whole result, and the UI
    // only surfaces a "general estimate" caveat next to the second-hand
    // range — a general_estimate retail_price_new would render as if it
    // were a verified current retail price with no caveat attached
    // (project.md E5). A specific "current retail price" should always be
    // something you can actually look up, not extrapolate.
    if (data.retail_price_new !== null) {
      ctx.addIssue({
        code: "custom",
        path: ["retail_price_new"],
        message: "retail_price_new requires market_evidence — a general estimate can only cover the second-hand range",
      });
    }
  } else if (hasAnyPrice) {
    ctx.addIssue({
      code: "custom",
      path: ["price_basis"],
      message: "price_basis must be market_evidence or general_estimate when a price is given",
    });
  }
});

export type ObjectAnalysis = z.infer<typeof BaseObjectAnalysisSchema>;

export const MAX_PHOTO_ROUNDS = 2;

// Room scan is a cheap, single-call, no-search first pass over a photo that
// may contain several objects — it only ever ballparks from general
// knowledge, never a real web search (that happens per-object, on demand,
// via the existing single-object pipeline with a focusHint). So every item
// here is implicitly general_estimate or unavailable — market_evidence
// doesn't apply, there's no price_sources concept at this stage.
export const RoomItemBasisSchema = z.enum(["general_estimate", "unavailable"]);

export const MAX_ROOM_ITEMS = 8;

const BaseRoomItemSchema = z.object({
  label: z.string().describe("Short human-readable name for the object, e.g. 'Vélo VTT rouge', 'Chaise en bois'"),
  category: z.string(),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  location_hint: z.string().describe("Plain-language description of where in the photo this object is, e.g. 'au premier plan à gauche', 'contre le mur du fond, en hauteur'"),
  currency: z.string().describe("ISO currency code, e.g. EUR"),
  estimated_value_low: z.number().nullable(),
  estimated_value_high: z.number().nullable(),
  price_basis: RoomItemBasisSchema,
  reasoning: z.string().describe("One or two sentences explaining the rough estimate, or why it's unavailable"),
});

// Same honesty invariants as ObjectAnalysisSchema's general_estimate branch,
// scaled down for a per-item context (project.md, correction du 1er octobre
// sur UNAVAILABLE utilisé par défaut) — a visible, identifiable object that's
// simply worth little must still get a near-zero number, not a refusal.
const RoomItemSchema = BaseRoomItemSchema.superRefine((data, ctx) => {
  for (const field of ["estimated_value_low", "estimated_value_high"] as const) {
    const value = data[field];
    if (value !== null && value < 0) {
      ctx.addIssue({ code: "custom", path: [field], message: `${field} cannot be negative` });
    }
  }
  if (
    data.estimated_value_low !== null &&
    data.estimated_value_high !== null &&
    data.estimated_value_low > data.estimated_value_high
  ) {
    ctx.addIssue({
      code: "custom",
      path: ["estimated_value_low"],
      message: "estimated_value_low cannot exceed estimated_value_high",
    });
  }

  const hasAnyPrice = data.estimated_value_low !== null || data.estimated_value_high !== null;
  const hasNonBlankReasoning = data.reasoning.trim().length > 0;

  if (data.price_basis === "general_estimate" && !hasAnyPrice) {
    ctx.addIssue({
      code: "custom",
      path: ["estimated_value_low"],
      message: "a general_estimate item must give an actual number, even a near-zero one — if it's worth almost nothing, say so as a number",
    });
  }
  if (hasAnyPrice && !hasNonBlankReasoning) {
    ctx.addIssue({
      code: "custom",
      path: ["reasoning"],
      message: "a priced item must explain what general knowledge the estimate is based on",
    });
  }
});

export const RoomScanAnalysisSchema = z.object({
  items: z.array(RoomItemSchema).max(MAX_ROOM_ITEMS),
});

export type RoomScanAnalysis = z.infer<typeof RoomScanAnalysisSchema>;
export type RoomItem = z.infer<typeof BaseRoomItemSchema>;

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

const BaseObjectAnalysisSchema = z.object({
  category: z.string().describe("One of: lego, electronics, sneakers, or other"),
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
  price_sources: z.array(PriceSourceSchema),

  reasoning_summary: z.array(z.string()).describe("Short bullet points explaining the valuation, for the 'Why this price?' UI section"),
});

const NUMERIC_PRICE_FIELDS = ["retail_price_new", "estimated_value_low", "estimated_value_high"] as const;

// A published price is a claim that needs evidence. These invariants exist
// because nothing upstream (prompting alone) reliably stops a priced result
// with no supporting source, or a reversed/negative range, from reaching the
// UI — see project.md R1.
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
  // A source with url+title but price: null is a citation, not an
  // observation — it cannot be the evidence behind a published number
  // (project.md C1, following R1).
  const hasObservedPrice = data.price_sources.some((source) => source.price !== null);
  if (hasAnyPrice && !hasObservedPrice) {
    ctx.addIssue({
      code: "custom",
      path: ["price_sources"],
      message: "a priced result must cite at least one source with an observed numeric price",
    });
  }
});

export type ObjectAnalysis = z.infer<typeof BaseObjectAnalysisSchema>;

export const MAX_PHOTO_ROUNDS = 2;

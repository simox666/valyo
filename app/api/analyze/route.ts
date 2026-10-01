import { NextRequest, NextResponse } from "next/server";
import { analyzeObject } from "@/lib/vision";
import { MAX_PHOTO_ROUNDS } from "@/lib/schema";
import { isValidImagePayload } from "@/lib/imageValidation";
import { checkRateLimit } from "@/lib/rateLimit";
import { classifyProviderError, newDiagnosticId } from "@/lib/errors";
import type { SupportedLocale } from "@/lib/prompts";
import type { ImageInput } from "@/lib/types";

const SUPPORTED_LOCALES: readonly SupportedLocale[] = ["fr", "en", "nl", "es"];

export const runtime = "nodejs";
// Measured scans run 30-170s — Valyo researches any object thoroughly
// now, not just LEGO/electronics/sneakers, so this stays in sync with
// lib/vision.ts's own internal deadline (170s) plus margin. On Vercel
// Hobby, serverless functions are capped at 60s regardless of this value;
// a Pro plan (up to 300s) or a background-job architecture is needed
// before deploying there. No such constraint on a self-hosted Node process.
export const maxDuration = 180;

interface AnalyzeRequestBody {
  images: ImageInput[];
  correction?: string;
  locale?: SupportedLocale;
}

const ALLOWED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BASE64_LENGTH = 8_000_000; // ~6MB image after resize/encode overhead
const MAX_CORRECTION_LENGTH = 500;

function clientIp(req: NextRequest): string {
  // req.headers is absent in the offline test harness's mock request —
  // fall back rather than throw so route logic stays testable without a
  // full Next.js request object.
  const forwarded = req.headers?.get?.("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export async function POST(req: NextRequest) {
  // Stopgap quota, not access control — see lib/rateLimit.ts for its real
  // limitations (in-memory, single-instance only). project.md R3: no
  // pilot should open before a real budget/access decision is made.
  const rate = checkRateLimit(clientIp(req));
  if (!rate.ok) {
    return NextResponse.json(
      { error: "Too many requests. Please wait before scanning again." },
      { status: 429, headers: { "Retry-After": String(rate.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  if (body === null || typeof body !== "object" || !("images" in body)) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { images, correction, locale } = body as { images: unknown; correction?: unknown; locale?: unknown };

  let correctionNote: string | undefined;
  if (correction !== undefined) {
    if (typeof correction !== "string") {
      return NextResponse.json({ error: "Invalid correction" }, { status: 400 });
    }
    const trimmed = correction.trim().slice(0, MAX_CORRECTION_LENGTH);
    correctionNote = trimmed.length > 0 ? trimmed : undefined;
  }

  // A client-chosen locale only ever picks which language the analysis is
  // written in — it's never trusted beyond this closed set, so an unknown
  // or spoofed value just falls back to the default rather than reaching
  // the prompt builder (same reasoning as every other client input here).
  const requestedLocale = typeof locale === "string" ? locale : undefined;
  const safeLocale: SupportedLocale = SUPPORTED_LOCALES.includes(requestedLocale as SupportedLocale)
    ? (requestedLocale as SupportedLocale)
    : "fr";

  if (!Array.isArray(images) || images.length === 0) {
    return NextResponse.json({ error: "At least one image is required" }, { status: 400 });
  }
  if (images.length > MAX_PHOTO_ROUNDS) {
    return NextResponse.json({ error: "Too many images" }, { status: 400 });
  }
  for (const img of images) {
    if (
      !img ||
      typeof img !== "object" ||
      typeof (img as ImageInput).data !== "string" ||
      typeof (img as ImageInput).mediaType !== "string"
    ) {
      return NextResponse.json({ error: "Invalid image data" }, { status: 400 });
    }
    const { mediaType, data } = img as ImageInput;
    if (!ALLOWED_MEDIA_TYPES.includes(mediaType)) {
      return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
    }
    if (data.length === 0 || data.length > MAX_BASE64_LENGTH) {
      return NextResponse.json({ error: "Invalid image data" }, { status: 400 });
    }
    // The declared mediaType is a client-supplied label — verify the bytes
    // actually match before spending a paid vision call on them (R4).
    if (!isValidImagePayload(mediaType, data)) {
      return NextResponse.json({ error: "Image data does not match a valid image file" }, { status: 400 });
    }
  }

  const validatedImages = images as ImageInput[];
  const round = validatedImages.length;

  try {
    const result = await analyzeObject(validatedImages, round, MAX_PHOTO_ROUNDS, correctionNote, req.signal, safeLocale);
    return NextResponse.json(result);
  } catch (err) {
    // Closed category + opaque id only — never the raw provider error
    // message, which can embed request/response details we don't control
    // (project.md C6). The id lets a specific failure be correlated in logs
    // without exposing what the provider actually said.
    const category = classifyProviderError(err);
    const diagnosticId = newDiagnosticId();
    console.error("analyze route failed", { category, diagnosticId });
    return NextResponse.json({ error: "Analysis failed. Please try again.", diagnosticId }, { status: 502 });
  }
}

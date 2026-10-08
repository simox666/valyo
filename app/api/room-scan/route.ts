import { NextRequest, NextResponse } from "next/server";
import { analyzeRoom } from "@/lib/vision";
import { isValidImagePayload } from "@/lib/imageValidation";
import { checkRateLimit } from "@/lib/rateLimit";
import { classifyProviderError, newDiagnosticId } from "@/lib/errors";
import type { SupportedLocale } from "@/lib/prompts";
import type { ImageInput } from "@/lib/types";

const SUPPORTED_LOCALES: readonly SupportedLocale[] = ["fr", "en", "nl", "es"];

export const runtime = "nodejs";
// No web_search round-trip here (see lib/vision.ts's analyzeRoom) — this is
// dominated by ordinary vision generation time. Kept comfortably above the
// pipeline's own ROOM_SCAN_TIMEOUT_MS (60s), same margin convention as
// app/api/analyze/route.ts.
export const maxDuration = 90;

interface RoomScanRequestBody {
  images: ImageInput[];
  locale?: SupportedLocale;
}

const ALLOWED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BASE64_LENGTH = 8_000_000; // ~6MB image after resize/encode overhead

function clientIp(req: NextRequest): string {
  const forwarded = req.headers?.get?.("x-forwarded-for");
  return forwarded?.split(",")[0]?.trim() || "unknown";
}

export async function POST(req: NextRequest) {
  // Shares the single-object scan's quota (project.md R3) — a room scan is
  // actually cheaper per call (one, no search), so sharing the bucket is
  // conservative, not generous.
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
  const { images, locale } = body as { images: unknown; locale?: unknown };

  const requestedLocale = typeof locale === "string" ? locale : undefined;
  const safeLocale: SupportedLocale = SUPPORTED_LOCALES.includes(requestedLocale as SupportedLocale)
    ? (requestedLocale as SupportedLocale)
    : "fr";

  // A room scan is a single wide shot, not a multi-round follow-up like the
  // single-object flow — exactly one image.
  if (!Array.isArray(images) || images.length !== 1) {
    return NextResponse.json({ error: "Exactly one image is required" }, { status: 400 });
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
    if (!isValidImagePayload(mediaType, data)) {
      return NextResponse.json({ error: "Image data does not match a valid image file" }, { status: 400 });
    }
  }

  const validatedImages = images as ImageInput[];

  try {
    const analysis = await analyzeRoom(validatedImages, safeLocale, req.signal);
    return NextResponse.json({ analysis });
  } catch (err) {
    const category = classifyProviderError(err);
    const diagnosticId = newDiagnosticId();
    console.error("room-scan route failed", { category, diagnosticId });
    return NextResponse.json({ error: "Analysis failed. Please try again.", diagnosticId }, { status: 502 });
  }
}

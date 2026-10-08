import { NextRequest, NextResponse } from "next/server";
import { put } from "@vercel/blob";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/session";
import { isValidImagePayload } from "@/lib/imageValidation";
import { checkRateLimit } from "@/lib/rateLimit";
import type { ImageInput } from "@/lib/types";

export const runtime = "nodejs";

const ALLOWED_MEDIA_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_BASE64_LENGTH = 8_000_000;
const MAX_LABEL_LENGTH = 120;

function clientIp(req: NextRequest): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  const rate = checkRateLimit(clientIp(req));
  if (!rate.ok) {
    return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  if (body === null || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { photo, label, truePrice, currency } = body as {
    photo?: unknown;
    label?: unknown;
    truePrice?: unknown;
    currency?: unknown;
  };

  if (
    !photo ||
    typeof photo !== "object" ||
    typeof (photo as ImageInput).data !== "string" ||
    typeof (photo as ImageInput).mediaType !== "string"
  ) {
    return NextResponse.json({ error: "Invalid photo" }, { status: 400 });
  }
  const { mediaType, data } = photo as ImageInput;
  if (!ALLOWED_MEDIA_TYPES.includes(mediaType)) {
    return NextResponse.json({ error: "Unsupported image type" }, { status: 400 });
  }
  if (data.length === 0 || data.length > MAX_BASE64_LENGTH) {
    return NextResponse.json({ error: "Invalid image data" }, { status: 400 });
  }
  if (!isValidImagePayload(mediaType, data)) {
    return NextResponse.json({ error: "Image data does not match a valid image file" }, { status: 400 });
  }

  if (typeof truePrice !== "number" || !Number.isFinite(truePrice) || truePrice < 0) {
    return NextResponse.json({ error: "Invalid price" }, { status: 400 });
  }
  if (typeof currency !== "string" || currency.trim().length === 0 || currency.length > 10) {
    return NextResponse.json({ error: "Invalid currency" }, { status: 400 });
  }
  const safeLabel = typeof label === "string" ? label.trim().slice(0, MAX_LABEL_LENGTH) : null;

  const extension = mediaType.split("/")[1] || "jpg";
  const buffer = Buffer.from(data, "base64");

  let blobUrl: string;
  try {
    const blob = await put(`challenges/${session.userId}-${Date.now()}.${extension}`, buffer, {
      access: "public",
      contentType: mediaType,
    });
    blobUrl = blob.url;
  } catch (err) {
    console.error("challenge photo upload failed", err instanceof Error ? err.message : err);
    return NextResponse.json({ error: "Could not upload the photo. Please try again." }, { status: 502 });
  }

  const { rows } = await sql<{ id: string }>`
    INSERT INTO challenges (creator_id, photo_url, label, true_price, currency)
    VALUES (${session.userId}, ${blobUrl}, ${safeLabel}, ${truePrice}, ${currency.trim().toUpperCase()})
    RETURNING id
  `;

  return NextResponse.json({ id: rows[0].id });
}

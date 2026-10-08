import { NextRequest, NextResponse } from "next/server";

// Stub analytics sink for MVP funnel metrics (see product spec section 19).
// Logs to stdout for now — swap for a real store once we're past validation.
//
// Closed allowlist: nothing about this endpoint stops a client from sending
// arbitrary JSON, so without one anything (photos, tokens, junk) could land
// in server logs. Only known event names and primitive prop values pass
// through (project.md R8).
const ALLOWED_EVENTS = new Set([
  "scan_started",
  "follow_up_photo_submitted",
  "follow_up_requested",
  "follow_up_skipped",
  "result_shown",
  "analysis_error",
  "scan_again_clicked",
  "correction_submitted",
  "game_started",
  "game_round_answered",
  "game_finished",
  "room_scan_started",
  "room_scan_result_shown",
  "room_scan_error",
  "room_item_detail_requested",
  "challenge_created",
  "challenge_started",
]);

const ALLOWED_PROP_KEYS = new Set([
  "round",
  "rounds",
  "identification_confidence",
  "price_confidence",
  "skipped_follow_up",
  "points",
  "within_range",
  "total_score",
  "item_count",
]);

function sanitizeProps(props: unknown): Record<string, number | boolean> {
  const clean: Record<string, number | boolean> = {};
  if (typeof props !== "object" || props === null || Array.isArray(props)) return clean;
  for (const [key, value] of Object.entries(props)) {
    if (!ALLOWED_PROP_KEYS.has(key)) continue;
    if (typeof value === "number" && Number.isFinite(value)) clean[key] = value;
    else if (typeof value === "boolean") clean[key] = value;
  }
  return clean;
}

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  if (body === null || typeof body !== "object") {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const { name, props } = body as { name?: unknown; props?: unknown };

  if (typeof name !== "string" || !ALLOWED_EVENTS.has(name)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  console.log("[event]", JSON.stringify({ name, props: sanitizeProps(props), ts: Date.now() }));
  return NextResponse.json({ ok: true });
}

import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/session";
import { scoreGuessAgainstPrice } from "@/lib/game/priceScoring";
import { currentBadge } from "@/lib/game/badges";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in required" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
  const { guessValue } = (body ?? {}) as { guessValue?: unknown };
  if (typeof guessValue !== "number" || !Number.isFinite(guessValue) || guessValue < 0) {
    return NextResponse.json({ error: "Invalid guess" }, { status: 400 });
  }

  const { rows } = await sql<{ creator_id: string; true_price: string; currency: string }>`
    SELECT creator_id, true_price, currency FROM challenges WHERE id = ${id}
  `;
  const challenge = rows[0];
  if (!challenge) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  if (challenge.creator_id === session.userId) {
    return NextResponse.json({ error: "You can't guess your own challenge" }, { status: 400 });
  }

  const truePrice = Number(challenge.true_price);
  const { points, withinTolerance } = scoreGuessAgainstPrice(guessValue, truePrice);

  // One guess per person per challenge (DB UNIQUE constraint) — ON CONFLICT
  // DO NOTHING instead of letting the insert throw, so a double-submit
  // (double-tap, retry) returns the already-recorded result rather than a
  // 500.
  const insertResult = await sql<{ id: string }>`
    INSERT INTO guesses (challenge_id, guesser_id, guess_value, points)
    VALUES (${id}, ${session.userId}, ${guessValue}, ${points})
    ON CONFLICT (challenge_id, guesser_id) DO NOTHING
    RETURNING id
  `;

  let awardedPoints = points;
  if (insertResult.rows.length === 0) {
    // Already guessed earlier — return that original result instead of
    // silently re-scoring or double-awarding points.
    const existing = await sql<{ guess_value: string; points: number }>`
      SELECT guess_value, points FROM guesses WHERE challenge_id = ${id} AND guesser_id = ${session.userId}
    `;
    awardedPoints = existing.rows[0]?.points ?? 0;
  } else {
    await sql`UPDATE users SET total_points = total_points + ${points} WHERE id = ${session.userId}`;
  }

  const userRows = await sql<{ total_points: number }>`SELECT total_points FROM users WHERE id = ${session.userId}`;
  const totalPoints = userRows.rows[0]?.total_points ?? 0;

  return NextResponse.json({
    points: awardedPoints,
    withinTolerance,
    truePrice,
    currency: challenge.currency,
    totalPoints,
    badge: currentBadge(totalPoints)?.key ?? null,
  });
}

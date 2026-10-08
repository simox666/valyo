import { NextRequest, NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/session";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await getSession();

  const { rows } = await sql<{
    id: string;
    creator_id: string;
    photo_url: string;
    label: string | null;
    true_price: string;
    currency: string;
  }>`SELECT id, creator_id, photo_url, label, true_price, currency FROM challenges WHERE id = ${id}`;
  const challenge = rows[0];
  if (!challenge) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const isCreator = session?.userId === challenge.creator_id;

  let existingGuess: { guess_value: string; points: number } | null = null;
  let yourTotalPoints: number | null = null;
  if (session) {
    const guessRows = await sql<{ guess_value: string; points: number }>`
      SELECT guess_value, points FROM guesses WHERE challenge_id = ${id} AND guesser_id = ${session.userId}
    `;
    existingGuess = guessRows.rows[0] ?? null;
    const userRows = await sql<{ total_points: number }>`SELECT total_points FROM users WHERE id = ${session.userId}`;
    yourTotalPoints = userRows.rows[0]?.total_points ?? null;
  }

  const revealPrice = isCreator || existingGuess !== null;

  return NextResponse.json({
    id: challenge.id,
    photoUrl: challenge.photo_url,
    label: challenge.label,
    currency: challenge.currency,
    isCreator,
    truePrice: revealPrice ? Number(challenge.true_price) : null,
    yourGuess: existingGuess ? Number(existingGuess.guess_value) : null,
    yourPoints: existingGuess ? existingGuess.points : null,
    yourTotalPoints,
  });
}

import { NextResponse } from "next/server";
import { sql } from "@/lib/db";
import { getSession } from "@/lib/session";
import { currentBadge, nextBadge } from "@/lib/game/badges";

export const runtime = "nodejs";

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ user: null });
  }

  const { rows } = await sql<{ email: string; total_points: number }>`
    SELECT email, total_points FROM users WHERE id = ${session.userId}
  `;
  const user = rows[0];
  if (!user) {
    return NextResponse.json({ user: null });
  }

  return NextResponse.json({
    user: {
      email: user.email,
      totalPoints: user.total_points,
      badge: currentBadge(user.total_points)?.key ?? null,
      nextBadge: nextBadge(user.total_points),
    },
  });
}

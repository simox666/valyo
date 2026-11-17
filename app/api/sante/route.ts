import { query } from "@/lib/db";

// Point de santé pour l'hébergeur : la base répond et les migrations sont appliquées.
// Aucune donnée renvoyée hormis l'état.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await query("SELECT 1");
    return Response.json({ ok: true });
  } catch {
    return Response.json({ ok: false }, { status: 503 });
  }
}

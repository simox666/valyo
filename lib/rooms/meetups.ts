import type { Query } from "../editorial/types.ts";
import { canModerateRoom, loadAccess, type RoomViewer } from "./permissions.ts";
import { sendMessage } from "./chat.ts";

export type MeetupOutcome<T = unknown> = ({ ok: true } & T) | { ok: false; status: number; message: string };

// Rendez-vous d'un salon : un journal club, une session « demandez-moi », une lecture commune…
// Créés par le propriétaire ou la modération du salon. La création est annoncée par un message
// dans la discussion : les suiveurs du salon sont ainsi notifiés par le circuit existant.

export interface Meetup {
  id: string;
  title: string;
  details: string;
  startsAt: string;
  createdBy: string;
  creatorName: string;
}

/** Rendez-vous à venir (et en cours depuis moins de 2 h), le plus proche d'abord. */
export async function listMeetups(q: Query, roomId: string, limit = 5): Promise<Meetup[]> {
  const rows = await q(
    `SELECT m.id, m.title, m.details, m.starts_at, m.created_by, u.display_name
     FROM room_meetups m JOIN users u ON u.id = m.created_by
     WHERE m.room_id = $1 AND m.canceled_at IS NULL AND m.starts_at > now() - interval '2 hours'
     ORDER BY m.starts_at ASC LIMIT $2`,
    [roomId, limit],
  );
  return rows.map((r) => ({
    id: r.id as string,
    title: r.title as string,
    details: r.details as string,
    startsAt: new Date(r.starts_at as string).toISOString(),
    createdBy: r.created_by as string,
    creatorName: (r.display_name as string) ?? "Un membre",
  }));
}

const refuse = (status: number, message: string): { ok: false; status: number; message: string } => ({ ok: false, status, message });

function frenchDate(iso: string): string {
  return new Intl.DateTimeFormat("fr-BE", {
    weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "Europe/Brussels",
  }).format(new Date(iso));
}

/** Crée un rendez-vous et l'annonce dans la discussion (même transaction). */
export async function createMeetup(
  q: Query,
  viewer: RoomViewer,
  roomId: string,
  input: { title: string; details: string; startsAt: string },
): Promise<MeetupOutcome<{ meetup: Meetup }>> {
  const access = await loadAccess(q, roomId, viewer, { forWrite: true });
  if (!access.room || (access.room.visibility === "private" && !access.membership)) return refuse(404, "Salon introuvable.");
  if (access.room.archived_at) return refuse(409, "Salon archivé : plus de nouveau rendez-vous.");
  if (!canModerateRoom(access)) return refuse(403, "Seuls le propriétaire et la modération du salon proposent des rendez-vous.");
  const starts = new Date(input.startsAt);
  if (!Number.isFinite(starts.getTime()) || starts.getTime() < Date.now()) return refuse(400, "La date du rendez-vous doit être à venir.");
  if (starts.getTime() > Date.now() + 366 * 86400000) return refuse(400, "Un rendez-vous se prévoit à moins d’un an.");
  const open = await q<{ n: number }>(`SELECT count(*)::int AS n FROM room_meetups WHERE room_id = $1 AND canceled_at IS NULL AND starts_at > now()`, [roomId]);
  if (Number(open[0]?.n ?? 0) >= 10) return refuse(409, "10 rendez-vous à venir au plus par salon.");
  const [row] = await q<{ id: string }>(
    `INSERT INTO room_meetups (room_id, created_by, title, details, starts_at) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [roomId, viewer.id, input.title, input.details, starts.toISOString()],
  );
  // Annonce dans la discussion : visible de tous, notifie les suiveurs du salon (circuit D29).
  await sendMessage(q, viewer, roomId, {
    clientId: `rdv-${row.id.slice(0, 8)}`,
    body: `📅 Rendez-vous : ${input.title} — ${frenchDate(starts.toISOString())}${input.details ? `\n${input.details}` : ""}`,
  });
  const meetups = await listMeetups(q, roomId, 50);
  return { ok: true, meetup: meetups.find((m) => m.id === row.id)! };
}

/** Annule un rendez-vous (propriétaire ou modération du salon). */
export async function cancelMeetup(q: Query, viewer: RoomViewer, roomId: string, meetupId: string): Promise<MeetupOutcome> {
  const access = await loadAccess(q, roomId, viewer, { forWrite: true });
  if (!access.room || (access.room.visibility === "private" && !access.membership)) return refuse(404, "Salon introuvable.");
  if (!canModerateRoom(access)) return refuse(403, "Seuls le propriétaire et la modération du salon annulent un rendez-vous.");
  const rows = await q(`UPDATE room_meetups SET canceled_at = now() WHERE id = $1 AND room_id = $2 AND canceled_at IS NULL RETURNING id`, [meetupId, roomId]);
  if (!rows.length) return refuse(404, "Rendez-vous introuvable ou déjà annulé.");
  return { ok: true };
}

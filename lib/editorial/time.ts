// Créneaux de récapitulatif dans un fuseau explicite (contrat §5).
// Les instants sont stockés en UTC ; un créneau est identifié par son
// occurrence locale (date + heure + fuseau), unique même lors des changements d'heure.

export interface SlotRule {
  /** 1 = lundi … 7 = dimanche (ISO). */
  weekday: number;
  /** "HH:MM" en heure locale. */
  time: string;
}

export interface Slot {
  key: string;
  at: Date;
}

interface LocalParts {
  year: number;
  month: number;
  day: number;
  hour: number;
  minute: number;
  weekday: number;
}

const WEEKDAYS: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

export function isValidTimeZone(tz: string): boolean {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function localParts(date: Date, tz: string): LocalParts {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      weekday: "short",
    })
      .formatToParts(date)
      .map((p) => [p.type, p.value]),
  );
  return {
    year: Number(parts.year),
    month: Number(parts.month),
    day: Number(parts.day),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
    weekday: WEEKDAYS[parts.weekday],
  };
}

function offsetMs(instant: number, tz: string): number {
  const p = localParts(new Date(instant), tz);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute);
  return asUtc - Math.floor(instant / 60000) * 60000;
}

/** Instant UTC d'une heure locale. Pour une heure inexistante ou ambiguë (changement d'heure), une seule occurrence est retenue. */
export function zonedToUtc(year: number, month: number, day: number, hour: number, minute: number, tz: string): Date {
  const wall = Date.UTC(year, month - 1, day, hour, minute);
  let instant = wall - offsetMs(wall, tz);
  const corrected = wall - offsetMs(instant, tz);
  if (corrected !== instant) instant = Math.min(instant, corrected);
  return new Date(instant);
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Créneaux dont l'instant est dans [from, to], dans l'ordre chronologique. */
export function slotsBetween(rules: SlotRule[], tz: string, from: Date, to: Date): Slot[] {
  const out = new Map<string, Slot>();
  const start = localParts(new Date(from.getTime() - 86400000), tz);
  const cursor = new Date(Date.UTC(start.year, start.month - 1, start.day));
  const end = to.getTime() + 2 * 86400000;
  while (cursor.getTime() <= end) {
    const y = cursor.getUTCFullYear();
    const m = cursor.getUTCMonth() + 1;
    const d = cursor.getUTCDate();
    const weekday = ((cursor.getUTCDay() + 6) % 7) + 1;
    for (const rule of rules) {
      if (rule.weekday !== weekday) continue;
      const [hh, mm] = rule.time.split(":").map(Number);
      const at = zonedToUtc(y, m, d, hh, mm, tz);
      if (at >= from && at <= to) {
        const key = `${y}-${pad(m)}-${pad(d)}T${pad(hh)}:${pad(mm)}[${tz}]`;
        out.set(key, { key, at });
      }
    }
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return [...out.values()].sort((a, b) => a.at.getTime() - b.at.getTime());
}

export function utcPeriod(date: Date): string {
  return date.toISOString().slice(0, 7);
}

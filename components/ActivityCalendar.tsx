// Carte d'activité façon GitHub : une case par jour (lundi en haut), une colonne par semaine.
// Teinte selon le nombre de contributions publiques (publications et commentaires).

const SHADES = ["bg-chip", "bg-accent/30", "bg-accent/60", "bg-accent"];
const shade = (n: number) => SHADES[n === 0 ? 0 : n === 1 ? 1 : n <= 3 ? 2 : 3];
const MONTHS = ["janv.", "févr.", "mars", "avr.", "mai", "juin", "juil.", "août", "sept.", "oct.", "nov.", "déc."];
const label = (day: string) => {
  const [y, m, d] = day.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};

export function ActivityCalendar({ days }: { days: { day: string; count: number }[] }) {
  const weeks: { day: string; count: number }[][] = [];
  for (let i = 0; i < days.length; i += 7) weeks.push(days.slice(i, i + 7));
  const total = days.reduce((sum, d) => sum + d.count, 0);
  const active = days.filter((d) => d.count > 0).length;
  return (
    <div>
      <div className="flex gap-[3px]" role="img" aria-label={`${total} contributions sur ${weeks.length} semaines, ${active} jours actifs`}>
        {weeks.map((week, w) => (
          <div key={w} className="flex flex-col gap-[3px]">
            {week.map((d) => (
              <span key={d.day} title={`${label(d.day)} : ${d.count} contribution${d.count > 1 ? "s" : ""}`} className={`h-[11px] w-[11px] rounded-[2px] ${shade(d.count)}`} />
            ))}
          </div>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted">{total} contribution{total > 1 ? "s" : ""} · {active} jour{active > 1 ? "s" : ""} actif{active > 1 ? "s" : ""}</p>
      <p className="mt-1 flex items-center gap-[3px] whitespace-nowrap text-[11px] text-muted" aria-hidden>
        <span className="mr-1">Moins</span>
        {SHADES.map((s) => <span key={s} className={`h-[9px] w-[9px] rounded-[2px] ${s}`} />)}
        <span className="ml-1">Plus</span>
      </p>
    </div>
  );
}

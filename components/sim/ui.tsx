// Briques communes des simulateurs : curseur, tuile de résultat, choix parmi quelques options.

export function Slider({ id, label, display, hint, min, max, step, value, onChange }: {
  id: string; label: string; display: string; hint?: string; min: number; max: number; step: number; value: number; onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={id} className="text-sm font-semibold">{label}</label>
        <span className="shrink-0 whitespace-nowrap font-mono text-sm tabular-nums text-accent">{display}</span>
      </div>
      <input id={id} type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(Number(e.target.value))}
        aria-describedby={hint ? `${id}-repere` : undefined} className="mt-2 h-8 w-full accent-accent" />
      {hint && <p id={`${id}-repere`} className="text-xs text-muted">{hint}</p>}
    </div>
  );
}

export function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
  return (
    <div className="rounded-lg bg-paper px-3 py-2.5 ring-1 ring-hairline">
      <dt className="label-mono">{label}</dt>
      <dd className="mt-0.5 font-display text-lg font-bold leading-tight">{value}</dd>
      {detail && <dd className="text-xs text-muted">{detail}</dd>}
    </div>
  );
}

export function Choice<T extends string | number>({ label, options, value, onChange }: {
  label: string; options: readonly { value: T; label: string }[]; value: T | null; onChange: (v: T) => void;
}) {
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-1.5">
      {options.map((o) => (
        <button key={String(o.value)} type="button" aria-pressed={o.value === value} onClick={() => onChange(o.value)}
          className={`inline-flex min-h-9 items-center rounded-lg px-2.5 text-sm font-medium ring-1 transition ${o.value === value ? "bg-accent-soft text-accent ring-accent/40" : "bg-white text-ink ring-line hover:ring-ink"}`}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export const fr = (n: number, digits = 1) => n.toLocaleString("fr-FR", { maximumFractionDigits: digits });

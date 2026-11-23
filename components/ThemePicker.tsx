"use client";

export function ThemePicker({
  themes,
  selected,
  onChange,
  max,
  invalid,
  describedBy,
}: {
  themes: { id: string; name: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  max?: number;
  invalid?: boolean;
  describedBy?: string;
}) {
  return (
    <div className="flex flex-wrap gap-2" aria-describedby={describedBy}>
      {themes.map((theme) => {
        const checked = selected.includes(theme.id);
        const disabled = !checked && max !== undefined && selected.length >= max;
        return (
          <label
            key={theme.id}
            className={`inline-flex cursor-pointer items-center gap-2 rounded-card border px-3 py-2 text-sm font-semibold ${
              checked ? "border-accent bg-accent-soft text-accent" : invalid ? "border-red-500 bg-white" : "border-line bg-white"
            } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
          >
            <input
              type="checkbox"
              className="h-4 w-4 accent-[#1C4F3C]"
              checked={checked}
              disabled={disabled}
              onChange={() => onChange(checked ? selected.filter((id) => id !== theme.id) : [...selected, theme.id])}
            />
            {theme.name}
          </label>
        );
      })}
    </div>
  );
}

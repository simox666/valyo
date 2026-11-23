import { themeElement } from "@/lib/theme-colors";

/**
 * Case de thème façon tableau périodique : numéro, symbole, et le nom sur les grandes cases.
 * `off` : case « non découverte » du profil — éteinte par le style (pointillés, gris) mais
 * au contraste conforme AA, pas par une opacité qui rendrait le texte illisible.
 */
export function ThemeTile({ slug, name, size = "md", active = false, off = false }: { slug: string; name?: string; size?: "sm" | "md" | "lg"; active?: boolean; off?: boolean }) {
  const e = themeElement(slug, name);
  const box = { sm: "h-8 w-8 p-[3px]", md: "h-9 w-9 p-[3px]", lg: "h-[58px] w-[58px] p-1" }[size];
  const sym = { sm: "text-[13px]", md: "text-[15px]", lg: "text-xl" }[size];
  const skin = active ? "bg-ink text-white" : off ? "border border-dashed border-line-strong bg-paper text-muted" : "bg-white text-ink ring-1 ring-ink/80";
  return (
    <span aria-hidden className={`flex shrink-0 flex-col justify-between rounded ${box} ${skin}`}>
      <span className={`font-mono leading-none ${size === "lg" ? "text-[10px]" : "text-[8px]"} ${active ? "" : "text-muted"}`}>{e.n || "·"}</span>
      <span className={`font-display font-bold leading-none ${sym}`}>{e.symbol}</span>
      {size === "lg" && <span className={`truncate text-[10px] leading-none ${active ? "" : off ? "text-muted" : "text-soft"}`}>{e.short}</span>}
    </span>
  );
}

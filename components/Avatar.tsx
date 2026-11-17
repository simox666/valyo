// Avatar d'un membre : initiales sur une couleur STABLE dérivée du pseudonyme
// (même personne = même couleur partout). Aucune image téléversée : rien à stocker
// ni à modérer. L'agent éditorial a son propre pictogramme ; un compte supprimé est neutre.

const PALETTE = ["#1C4F3C", "#2F5D8A", "#8A4B2F", "#6B3F8A", "#2F7A6E", "#8A6B1F", "#7A2F4B", "#3F5A2F"];

function colorFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  const first = parts[0][0] ?? "";
  const second = parts.length > 1 ? parts[parts.length - 1][0] ?? "" : "";
  return (first + second).toUpperCase();
}

const SIZES = { xs: "h-6 w-6 text-[10px]", sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-16 w-16 text-xl", xl: "h-24 w-24 text-3xl" } as const;

export function Avatar({
  name,
  seed,
  size = "sm",
  agent = false,
  deleted = false,
  imageId,
}: {
  name: string;
  seed?: string | null;
  size?: keyof typeof SIZES;
  agent?: boolean;
  deleted?: boolean;
  /** Photo de profil envoyée par le membre (servie par /media/id). */
  imageId?: string | null;
}) {
  const base = `inline-flex shrink-0 select-none items-center justify-center rounded-full font-bold ${SIZES[size]}`;
  if (deleted) return <span aria-hidden className={`${base} bg-line text-neutral-500`}>?</span>;
  // eslint-disable-next-line @next/next/no-img-element
  if (imageId) return <img src={`/media/${imageId}`} alt="" aria-hidden loading="lazy" className={`${base} bg-chip object-cover`} />;
  if (agent) return <span aria-hidden className={`${base} bg-accent-soft text-accent ring-1 ring-accent/30`}>✦</span>;
  return (
    <span aria-hidden className={`${base} text-white`} style={{ backgroundColor: colorFor(seed || name) }}>
      {initials(name)}
    </span>
  );
}

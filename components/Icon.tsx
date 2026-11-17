// Icônes des cartes du fil, en sprite SVG : les tracés ne sont émis QU'UNE fois par page
// (IconSprite, dans la mise en page), chaque usage n'étant qu'une référence <use>.
// Audit performance du 17 novembre : ~7 icônes recopiées sur chaque carte ≈ 40 Ko de HTML
// évités sur le fil. Les attributs de présentation (trait, remplissage) restent portés par
// l'élément <svg> appelant et s'héritent dans le tracé référencé.

const SYMBOLS: Record<string, React.ReactNode> = {
  interessant: <path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9V16h7v-2.1A6 6 0 0 0 12 3z" />,
  appris: <><path d="M3 9l9-5 9 5-9 5z" /><path d="M7 11v5c3 2 7 2 10 0v-5" /></>,
  a_creuser: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  commenter: <path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />,
  salon: <><path d="M4 5h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" /><path d="M19 9h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-1v2l-3-2h-4" /></>,
  relayer: <><path d="M17 2.5 21 6.5l-4 4" /><path d="M3 11V9a2.5 2.5 0 0 1 2.5-2.5H21" /><path d="m7 21.5-4-4 4-4" /><path d="M21 13v2a2.5 2.5 0 0 1-2.5 2.5H3" /></>,
  partager: <><path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" /><path d="M12 3v12M7 8l5-5 5 5" /></>,
  source: <path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />,
  synthese: <><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8z" /><path d="M19 15l.7 1.8L21.5 17.5l-1.8.7L19 20l-.7-1.8-1.8-.7 1.8-.7z" /></>,
  personnes: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.2a6.5 6.5 0 0 1 3.5 5.8" /></>,
};

/** À rendre UNE fois, dans la mise en page. */
export function IconSprite() {
  return (
    <svg aria-hidden width="0" height="0" style={{ position: "absolute" }}>
      <defs>
        {Object.entries(SYMBOLS).map(([id, node]) => (
          <symbol key={id} id={`vi-${id}`} viewBox="0 0 24 24">{node}</symbol>
        ))}
      </defs>
    </svg>
  );
}

export function Icon({ id, size = 18, strokeWidth = 1.7, className, filled = false }: {
  id: keyof typeof SYMBOLS & string;
  size?: number;
  strokeWidth?: number;
  className?: string;
  /** Remplissage léger (réaction active). */
  filled?: boolean;
}) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={filled ? "currentColor" : "none"} fillOpacity={filled ? 0.15 : 0}
      stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={className}>
      <use href={`#vi-${id}`} />
    </svg>
  );
}

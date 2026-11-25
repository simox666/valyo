// Pictogrammes des jeux et des simulateurs : un dessin au trait par jeu, dans une pastille orange pâle.
// Même grammaire que les icônes du fil (grille 24, trait rond de 1,7) pour que l'ensemble reste d'une seule main.
// Les pleins (petits disques) portent className="fill-current".

const dot = "fill-current stroke-none";

const PICTOS = {
  // ——— Jeux ———
  defi: <><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /><path d="m9 15.2 2.2 2.2 4.3-4.6" /></>,
  hebdo: <><path d="M4 5h13v14a1.5 1.5 0 0 0 1.5 1.5H5.5A1.5 1.5 0 0 1 4 19z" /><path d="M17 9.5h3V19a1.5 1.5 0 0 1-1.5 1.5" /><path d="M7 9h7M7 12.5h7M7 16h4" /></>,
  quiz: <><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" /><path d="M10.8 9.8a2.3 2.3 0 1 1 3.3 2.1c-.7.4-1.1.9-1.1 1.7" /><circle cx="13" cy="16.2" r=".9" className={dot} /></>,
  vf: <><path d="m3 8.5 3.2 3.2L11.5 5" /><path d="m14 13.5 6 6M20 13.5l-6 6" /><path d="M15.5 4 8.5 20" strokeOpacity=".35" /></>,
  duel: <><path d="M12 4v16M7.5 20h9M5 7h14" /><path d="M5 7l-2.5 6a2.7 2.7 0 0 0 5 0z" /><path d="M19 7l-2.5 6a2.7 2.7 0 0 0 5 0z" /></>,
  frise: <><path d="M2.5 12h2.2M8.3 12h1.9M13.8 12h1.9M19.3 12h2.2" /><circle cx="6.5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="17.5" cy="12" r="1.8" /><path d="M6.5 10.2V6M12 13.8V18M17.5 10.2V6" /></>,
  // ——— Simulateurs ———
  creature: <><path d="M12 6.5c-4 0-6.5 2.7-6.5 6.3S8.4 20.5 12 20.5s6.5-4.1 6.5-7.7S16 6.5 12 6.5z" /><circle cx="9.5" cy="12.6" r="1.3" className={dot} /><circle cx="14.5" cy="12.6" r="1.3" className={dot} /><path d="M9 7.2 7.5 3.5M15 7.2l1.5-3.7" /><path d="M10 16.4c1.2.8 2.8.8 4 0" /></>,
  orbite: <><circle cx="12" cy="12" r="2.4" className={dot} /><ellipse cx="12" cy="12" rx="9.5" ry="4.6" transform="rotate(-25 12 12)" /><circle cx="19.3" cy="6.6" r="1.5" className={dot} /></>,
  "poids-age": <><rect x="4" y="4" width="16" height="16" rx="3" /><path d="M7.5 10.5a6 6 0 0 1 9 0" /><path d="m12 12.5 1.7-3.3" /></>,
  fentes: <><path d="M2.5 12h3" /><path d="M9 3v5.2M9 10.8v2.4M9 15.8V21" /><path d="M18.5 5h2M16 8.5h4.5M13.5 12h7M16 15.5h4.5M18.5 19h2" /></>,
  "mix-electrique": <path d="M13 2.5 5 13.5h6l-1 8 8-11h-6z" />,
  climat: <><path d="M9 14.5V5a2.5 2.5 0 0 1 5 0v9.5a4.3 4.3 0 1 1-5 0z" /><path d="M11.5 9v6.5" /><circle cx="11.5" cy="17.5" r="1.5" className={dot} /><path d="M17.5 6H20M17.5 9.5H20" /></>,
  epidemie: <><circle cx="12" cy="12" r="5" /><path d="M12 7V3.5M12 17v3.5M7 12H3.5M17 12h3.5M8.5 8.5 6 6M15.5 8.5 18 6M8.5 15.5 6 18M15.5 15.5 18 18" /><circle cx="10.5" cy="11" r=".9" className={dot} /><circle cx="13.6" cy="13.3" r=".9" className={dot} /></>,
  selection: <><path d="M8 3c0 5 8 4.5 8 9s-8 4-8 9" /><path d="M16 3c0 5-8 4.5-8 9s8 4 8 9" /><path d="M9.5 12h5" /></>,
  neurone: <><path d="M5 6l7 2.5M5 12l7-3.5M5 12l7 3.5M5 18l7-2.5M12 8.5l7 3.5M12 15.5l7-3.5" strokeWidth="1.2" /><circle cx="5" cy="6" r="1.9" className={dot} /><circle cx="5" cy="12" r="1.9" className={dot} /><circle cx="5" cy="18" r="1.9" className={dot} /><circle cx="12" cy="8.5" r="1.9" className={dot} /><circle cx="12" cy="15.5" r="1.9" className={dot} /><circle cx="19" cy="12" r="1.9" className={dot} /></>,
  "mot-de-passe": <><rect x="5" y="10.5" width="14" height="10" rx="2" /><path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" /><path d="M12 14.3v2.6" /></>,
  bras: <><path d="M3.5 20.5h10M8.5 20.5v-3" /><circle cx="8.5" cy="15.5" r="2" /><path d="M9.7 13.9 13.3 9" /><circle cx="14.5" cy="7.5" r="1.9" /><path d="m16.1 8.6 2.5 2" /><path d="M18.6 10.6c-1.3.5-1.9 1.7-1.6 3M18.6 10.6c1.4-.2 2.5.5 2.9 1.7" /></>,
} as const;

export type PictoId = keyof typeof PICTOS;

const BOX = { sm: "h-9 w-9 rounded-lg", md: "h-11 w-11 rounded-xl", lg: "h-14 w-14 rounded-2xl" } as const;
const GLYPH = { sm: 20, md: 24, lg: 30 } as const;

export function Picto({ id, size = "md", className = "" }: { id: PictoId; size?: keyof typeof BOX; className?: string }) {
  return (
    <span aria-hidden className={`flex shrink-0 items-center justify-center bg-accent-soft text-accent ${BOX[size]} ${className}`}>
      <svg width={GLYPH[size]} height={GLYPH[size]} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {PICTOS[id]}
      </svg>
    </span>
  );
}

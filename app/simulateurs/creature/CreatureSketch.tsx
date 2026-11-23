import type { Creature } from "@/lib/simulateurs/creature.ts";

// Croquis de naturaliste : traits à l'encre (couleur du texte), aplat coloré, sans hasard.
// Chaque membre est un « tube » : un trait large à l'encre recouvert d'un trait plus fin de la couleur du corps.

const W = 400;
const H = 300;
const GROUND = 256;

function Tube({ d, width, fill }: { d: string; width: number; fill: string }) {
  return (
    <>
      <path d={d} fill="none" stroke="currentColor" strokeWidth={width + 3} strokeLinecap="round" strokeLinejoin="round" />
      <path d={d} fill="none" stroke={fill} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" />
    </>
  );
}

export function CreatureSketch({ creature: c }: { creature: Creature }) {
  const fill = c.fill;
  const rx = 55 + 45 * c.bodyW;
  const ry = 25 + 60 * c.bodyH;
  const legPx = 20 + 110 * c.legLength;
  const airborne = c.locomotion === "vol" || c.locomotion === "flotte";
  const cx = 205;
  const cy = c.locomotion === "flotte" ? 150 : c.locomotion === "vol" ? 128 : GROUND - legPx - ry * 0.75;
  const bodyRx = c.locomotion === "flotte" ? rx * 0.55 : rx;
  const bodyRy = c.locomotion === "flotte" ? ry * 0.7 : ry;

  // Tête et cou.
  const neckLen = 12 + 70 * c.neck;
  const neckFrom = { x: cx + bodyRx * 0.78, y: cy - bodyRy * 0.3 };
  const head = { x: neckFrom.x + 12 + neckLen * 0.55, y: neckFrom.y - 6 - neckLen * 0.8 };
  const headR = 19;
  const neckPath = `M${neckFrom.x - 6} ${neckFrom.y + 4} L${head.x - 4} ${head.y + 6}`;
  const eyeR = 3 + 6.5 * c.eyes;

  // Pattes : la moitié au premier plan, l'autre moitié derrière (plus claires).
  const pairs = Math.max(0, Math.round(c.legs / 2));
  const legW = 4 + 13 * c.legWidth;
  const legTop = cy + bodyRy * 0.55;
  const legXs = Array.from({ length: pairs }, (_, i) => (pairs === 1 ? cx : cx - bodyRx * 0.62 + (i * bodyRx * 1.24) / (pairs - 1)));
  const footY = airborne ? legTop + legPx : GROUND;
  // Une seule paire : on écarte la patte du fond pour qu'on voie bien les deux.
  const farShift = pairs === 1 ? 26 : 9;
  const leg = (x: number, bend: number) => `M${x} ${legTop} L${x + bend} ${(legTop + footY) / 2} L${x} ${footY - legW / 2} l${legW * 0.7} 0`;

  // Revêtement.
  const fur =
    c.cover === "fourrure"
      ? Array.from({ length: 44 }, (_, i) => {
          const a = (i / 44) * Math.PI * 2;
          const len = 4 + 9 * c.coverDensity;
          const x = cx + Math.cos(a) * bodyRx;
          const y = cy + Math.sin(a) * bodyRy;
          return `M${x.toFixed(1)} ${y.toFixed(1)} l${(Math.cos(a + 0.5) * len).toFixed(1)} ${(Math.sin(a + 0.5) * len).toFixed(1)}`;
        }).join(" ")
      : "";
  const scales =
    c.cover === "ecailles"
      ? Array.from({ length: 5 }, (_, row) =>
          Array.from({ length: 12 }, (_, col) => {
            const x = cx - bodyRx + col * (bodyRx / 6) + (row % 2 ? bodyRx / 12 : 0);
            const y = cy - bodyRy * 0.6 + row * (bodyRy * 0.3);
            return `M${x.toFixed(1)} ${y.toFixed(1)} q${(bodyRx / 12).toFixed(1)} 7 ${(bodyRx / 6).toFixed(1)} 0`;
          }).join(" "),
        ).join(" ")
      : "";
  const plates =
    c.cover === "carapace"
      ? [-0.6, -0.2, 0.2, 0.6].map((k) => `M${(cx + k * bodyRx).toFixed(1)} ${(cy - bodyRy).toFixed(1)} q${(8 * (k < 0 ? -1 : 1)).toFixed(1)} ${bodyRy.toFixed(1)} 0 ${(bodyRy * 2).toFixed(1)}`).join(" ")
      : "";
  const spots = c.cover === "peau" ? [[-0.45, -0.25, 7], [-0.1, -0.4, 5], [0.25, -0.2, 6], [-0.25, 0.15, 4]] : [];

  // Échelle : silhouette humaine de 1,70 m à côté.
  const top = c.locomotion === "flotte" ? cy - bodyRy - 75 : Math.min(head.y - headR, cy - bodyRy);
  const bottom = airborne ? Math.max(footY, cy + bodyRy + (c.locomotion === "flotte" ? 70 : 0)) : GROUND;
  const pxPerM = (bottom - top) / c.heightM;
  // L'humain ne dépasse jamais 150 px : pour une petite créature, c'est elle qu'on réduit.
  const wanted = 1.7 * pxPerM;
  const human = Math.min(150, Math.max(14, wanted));
  const shrink = Math.min(1, Math.max(0.3, human / wanted));
  const hx = 40;
  const u = human / 8;

  const clipId = `corps-${c.name.replace(/\s+/g, "-")}`;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Croquis : ${c.common}, ${c.name}`} className="h-auto w-full text-ink">
      <defs>
        <clipPath id={clipId}><ellipse cx={cx} cy={cy} rx={bodyRx} ry={bodyRy} /></clipPath>
      </defs>

      {/* Sol */}
      <path d={`M10 ${GROUND} H${W - 10}`} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d={Array.from({ length: 19 }, (_, i) => `M${20 + i * 20} ${GROUND + 6} l-8 10`).join(" ")} stroke="currentColor" strokeWidth="1" opacity="0.3" />
      {c.locomotion === "fouit" && (
        <>
          <ellipse cx={cx - bodyRx - 26} cy={GROUND} rx="30" ry="8" fill="currentColor" opacity="0.55" />
          <path d={`M${cx - bodyRx - 62} ${GROUND} q10 -16 26 -10 q14 -12 30 2`} fill="none" stroke="currentColor" strokeWidth="1.5" />
        </>
      )}

      {/* Silhouette humaine pour l'échelle */}
      <g stroke="currentColor" strokeWidth={Math.min(4, Math.max(1.2, u * 0.45))} strokeLinecap="round" fill="none" opacity="0.55">
        <circle cx={hx} cy={GROUND - human + u} r={u} fill="currentColor" stroke="none" />
        <path d={`M${hx} ${GROUND - human + 2 * u} V${GROUND - 3 * u} M${hx} ${GROUND - 3 * u} l${-1.2 * u} ${3 * u} M${hx} ${GROUND - 3 * u} l${1.2 * u} ${3 * u} M${hx - 1.6 * u} ${GROUND - 4.6 * u} L${hx} ${GROUND - 5.6 * u} L${hx + 1.6 * u} ${GROUND - 4.6 * u}`} />
      </g>
      <text x={hx} y={H - 8} textAnchor="middle" className="fill-current font-mono" fontSize="9" opacity="0.7">1,70 m</text>

      <g transform={`translate(${cx + 20} ${GROUND}) scale(${shrink.toFixed(3)}) translate(${-cx} ${-GROUND})`}>
      {airborne && <ellipse cx={cx} cy={GROUND + 1} rx={bodyRx * 0.8} ry="5" fill="currentColor" opacity="0.15" />}
      {/* Sacs de gaz (flotteur) */}
      {Array.from({ length: c.sacs }, (_, i) => {
        const sx = cx + (i - (c.sacs - 1) / 2) * 62;
        const sy = cy - bodyRy - 42 - (i % 2 ? 14 : 0);
        return (
          <g key={`sac-${i}`}>
            <path d={`M${sx} ${sy + 34} L${cx + (i - (c.sacs - 1) / 2) * 18} ${cy - bodyRy + 4}`} stroke="currentColor" strokeWidth="1.5" />
            <circle cx={sx} cy={sy} r="36" fill={fill} fillOpacity="0.45" stroke="currentColor" strokeWidth="2" />
            <path d={`M${sx - 20} ${sy - 14} q8 -14 22 -16`} fill="none" stroke="currentColor" strokeWidth="1.2" opacity="0.6" />
          </g>
        );
      })}

      {/* Aile arrière, queue, pattes arrière */}
      {c.wings > 0 && (
        <path d={`M${cx + 6} ${cy - bodyRy * 0.6} L${cx - 20 - 95 * c.wings} ${cy - bodyRy - 55 * c.wings} Q${cx - 70 * c.wings} ${cy - 6} ${cx - bodyRx * 0.5} ${cy + 4} Z`} fill={fill} fillOpacity="0.4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
      )}
      {c.tail > 0.15 && <Tube d={`M${cx - bodyRx * 0.85} ${cy} q${-18 - 40 * c.tail} ${-4} ${-26 - 62 * c.tail} ${14 + 20 * c.tail}`} width={5 + 5 * c.legWidth} fill={fill} />}
      <g opacity="0.55">
        {legXs.map((x, i) => <Tube key={`ar-${i}`} d={leg(x + farShift, -5)} width={legW} fill={fill} />)}
      </g>

      {/* Tentacules (flotteur) */}
      {c.locomotion === "flotte" &&
        [-0.6, -0.2, 0.2, 0.6].map((k, i) => (
          <path key={`t-${i}`} d={`M${cx + k * bodyRx} ${cy + bodyRy * 0.7} q${10 * (i % 2 ? 1 : -1)} 20 0 38 q${-10 * (i % 2 ? 1 : -1)} 18 4 ${28 + (i % 2) * 10}`} fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
        ))}

      {/* Cou (contour), corps, tête, puis remplissage du cou par-dessus les jonctions */}
      <path d={neckPath} fill="none" stroke="currentColor" strokeWidth="23" strokeLinecap="round" />
      <ellipse cx={cx} cy={cy} rx={bodyRx} ry={bodyRy} fill={fill} stroke="currentColor" strokeWidth={c.cover === "carapace" ? 3.5 : 2} />
      <g clipPath={`url(#${clipId})`} fill="none" stroke="currentColor">
        {scales && <path d={scales} strokeWidth="1" opacity="0.6" />}
        {plates && <path d={plates} strokeWidth="2" />}
        {spots.map(([dx, dy, r], i) => <circle key={`s-${i}`} cx={cx + dx * bodyRx} cy={cy + dy * bodyRy} r={r} fill="currentColor" stroke="none" opacity="0.18" />)}
      </g>
      {fur && <path d={fur} fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />}

      {/* Crêtes qui évacuent la chaleur */}
      {c.ears > 0.1 &&
        [-1, 1].map((s) => (
          <path key={`e-${s}`} d={`M${head.x + s * 6} ${head.y - headR + 4} q${s * (10 + 14 * c.ears)} ${-(14 + 34 * c.ears)} ${s * 3} ${-(20 + 44 * c.ears)} q${-s * 12} ${14 + 20 * c.ears} ${-s * 9} ${18 + 40 * c.ears} Z`} fill={fill} stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
        ))}
      <circle cx={head.x} cy={head.y} r={headR} fill={fill} stroke="currentColor" strokeWidth="2" />
      <path d={neckPath} fill="none" stroke={fill} strokeWidth="20" strokeLinecap="round" />
      {c.cover === "fourrure" && (
        <path d={Array.from({ length: 9 }, (_, i) => { const a = -Math.PI + (i / 8) * Math.PI; return `M${(head.x + Math.cos(a) * headR).toFixed(1)} ${(head.y + Math.sin(a) * headR).toFixed(1)} l${(Math.cos(a) * 6).toFixed(1)} ${(Math.sin(a) * 6).toFixed(1)}`; }).join(" ")} stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
      )}

      {/* Museau et narines : d'autant plus larges que l'air est ténu */}
      <ellipse cx={head.x + headR * 0.85} cy={head.y + 5} rx={7 + 9 * c.nostrils} ry={6 + 5 * c.nostrils} fill={fill} stroke="currentColor" strokeWidth="1.8" />
      {c.nostrils > 0 || c.locomotion !== "fouit" ? (
        <>
          <circle cx={head.x + headR * 0.85 + 3 + 4 * c.nostrils} cy={head.y + 3} r={1 + 2.6 * c.nostrils} fill="currentColor" />
          <circle cx={head.x + headR * 0.85 + 2 + 3 * c.nostrils} cy={head.y + 8 + 2 * c.nostrils} r={1 + 2.2 * c.nostrils} fill="currentColor" />
        </>
      ) : null}
      {/* Œil */}
      <circle cx={head.x + 3} cy={head.y - 5} r={eyeR} fill="#fff" stroke="currentColor" strokeWidth="1.6" />
      <circle cx={head.x + 3 + eyeR * 0.25} cy={head.y - 5} r={Math.max(1.2, eyeR * 0.5)} fill="#1B2430" />

      {/* Pattes avant, aile avant */}
      {legXs.map((x, i) => <Tube key={`av-${i}`} d={leg(x, 5)} width={legW} fill={fill} />)}
      {c.locomotion === "fouit" && legXs.map((x, i) => <path key={`g-${i}`} d={`M${x + legW * 0.7} ${GROUND - 2} l5 3 M${x + legW * 0.7} ${GROUND - 5} l6 0`} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />)}
      {c.wings > 0 && (
        <>
          <path d={`M${cx + 14} ${cy - bodyRy * 0.5} L${cx - 110 * c.wings} ${cy - bodyRy - 78 * c.wings} Q${cx - 86 * c.wings} ${cy + 8} ${cx - bodyRx * 0.35} ${cy + bodyRy * 0.3} Z`} fill={fill} fillOpacity="0.75" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
          <path d={`M${cx + 14} ${cy - bodyRy * 0.5} L${cx - 78 * c.wings} ${cy - 20 * c.wings} M${cx + 14} ${cy - bodyRy * 0.5} L${cx - 50 * c.wings} ${cy + 6}`} stroke="currentColor" strokeWidth="1" opacity="0.6" />
        </>
      )}
      </g>
    </svg>
  );
}

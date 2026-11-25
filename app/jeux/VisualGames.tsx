"use client";

// Les jeux « Coup d'œil » : on place, on trace, on glisse — moins de lecture, plus d'intuition.
//  - À l'échelle : placer un objet sur une règle, entre le plus petit et le plus grand de sa série ;
//  - Dessine la courbe : tracer l'évolution d'une grandeur, puis la comparer à la vraie ;
//  - La frise : glisser des événements dans l'ordre sur une ligne du temps.
// Chaque jeu se joue aussi au clavier. Le serveur rejoue la partie à partir de sa graine pour noter.

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { COURBE_TOLERANCE, courbeGame, height, toDraw, valueAt, type Curve } from "@/lib/jeux/courbes.ts";
import { ECHELLE_TOLERANCE, echelleGame, type ScaleBoard } from "@/lib/jeux/echelle.ts";
import { friseGame, FRISE_EVENTS, type Frise } from "@/lib/jeux/tirage.ts";
import { EndScreen, type VisualGameProps } from "./shared";

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)));

/** Nouvelle manche : on revient en haut de la carte (la correction précédente a pu faire défiler la page). */
const backToTop = () => void requestAnimationFrame(() => document.getElementById("jeu")?.scrollIntoView({ block: "start", behavior: "smooth" }));

function Head({ title, step, total, theme, subject }: { title: string; step: number; total: number; theme: string; subject: string }) {
  return (
    <>
      <div className="flex items-baseline justify-between gap-3">
        <p className="label-mono text-accent">{title}</p>
        <p className="shrink-0 text-sm text-muted">{step + 1} / {total}</p>
      </div>
      <p className="mt-2 text-xs font-semibold uppercase tracking-wide text-muted">{theme}</p>
      <p className="mt-1 text-lg font-bold leading-snug">{subject}</p>
    </>
  );
}

// ───────────────────────────── À l'échelle ─────────────────────────────

/** Hauteur utile de la règle et écart minimal entre deux étiquettes, en pixels. */
const RULER = 280;
const LABEL_GAP = 40;

export function EchelleGame({ seed, themeNames, isMember, outcome, onFinish, onReplay, onExit }: VisualGameProps) {
  const [boards] = useState<ScaleBoard[]>(() => echelleGame(seed));
  const [b, setB] = useState(0);
  const [i, setI] = useState(0);
  const [pos, setPos] = useState(50);
  const [checked, setChecked] = useState(false);
  const [row, setRow] = useState<number[]>([]);
  const [all, setAll] = useState<number[][]>([]);
  const [score, setScore] = useState(0);
  const track = useRef<HTMLDivElement>(null);
  useEffect(backToTop, []);
  const dragging = useRef(false);
  const total = boards.reduce((n, board) => n + board.items.length, 0);

  if (b >= boards.length) {
    return <EndScreen title="À l’échelle" score={score} total={total} unit="objets bien placés" outcome={outcome} isMember={isMember} onReplay={onReplay} onExit={onExit} />;
  }

  const board = boards[b];
  const item = board.items[i];
  const answer = board.answers[i];
  const right = Math.abs(pos - answer) <= ECHELLE_TOLERANCE;
  const fromPointer = (clientY: number) => {
    const rect = track.current?.getBoundingClientRect();
    if (rect) setPos(clamp((100 * (rect.bottom - clientY)) / rect.height));
  };
  // Ce qui est écrit sur la règle : ses deux extrémités, puis les objets déjà placés, chacun en face de son point.
  const known = [
    { key: "haut", pos: 100, label: board.high.label, display: board.high.display, caption: "maximum" },
    ...board.items.slice(0, i + (checked ? 1 : 0)).map((it, k) => ({ key: it.label, pos: board.answers[k], label: it.label, display: it.display, caption: "" })),
    { key: "bas", pos: 0, label: board.low.label, display: board.low.display, caption: "minimum" },
  ].sort((x, y) => y.pos - x.pos);
  // Deux points proches : leurs étiquettes s'écartent (un trait les relie à leur point).
  const tops = known.map((k) => (1 - k.pos / 100) * RULER);
  for (let k = 1; k < tops.length; k++) tops[k] = Math.max(tops[k], tops[k - 1] + LABEL_GAP);
  for (let k = tops.length - 1; k >= 0; k--) tops[k] = Math.min(tops[k], k === tops.length - 1 ? RULER : tops[k + 1] - LABEL_GAP);

  const validate = () => {
    setChecked(true);
    setRow((r) => [...r, pos]);
    if (right) setScore((s) => s + 1);
  };
  const next = () => {
    const lastOfBoard = i + 1 === board.items.length;
    if (lastOfBoard) {
      const done = [...all, row];
      setAll(done);
      setRow([]);
      if (b + 1 === boards.length) onFinish(done);
      setB((x) => x + 1);
      setI(0);
    } else {
      setI((x) => x + 1);
    }
    setPos(50);
    setChecked(false);
    backToTop();
  };

  return (
    <section id="jeu" className="card scroll-mt-20 p-5 sm:p-6 lg:scroll-mt-6">
      <Head title="À l’échelle" step={b} total={boards.length} theme={themeNames.get(board.theme) ?? board.theme} subject={board.title} />
      <div className="mt-3 flex items-end justify-between gap-3" aria-live="polite">
        {!checked ? (
          <p className="min-w-0 text-sm text-soft">Où placer<span className="block text-lg font-bold leading-snug text-ink">{item.label} ?</span></p>
        ) : (
          <p className="min-w-0 text-sm text-soft">
            <span className={`block text-lg font-bold leading-snug ${right ? "text-accent" : "text-ink"}`}>{right ? "Bien placé !" : pos > answer ? "Trop haut." : "Trop bas."}</span>
            {item.label} : <strong className="text-ink">{item.display}</strong>
          </p>
        )}
        <button type="button" onClick={checked ? next : validate} className="btn-primary shrink-0">
          {!checked ? "Valider" : i + 1 < board.items.length ? "Suivant" : b + 1 < boards.length ? "Règle suivante" : "Mon score"}
        </button>
      </div>
      {!checked && b === 0 && i === 0 && <p className="mt-1 text-xs text-muted">Glissez le repère orange le long de la règle, entre ses deux extrémités (ou flèches du clavier).</p>}

      {/* La règle : la plus petite valeur en bas, la plus grande en haut, chacune nommée en face de son point. */}
      <div className="relative mt-4" style={{ height: RULER + 32 }}>
        <div
          role="slider" tabIndex={checked ? -1 : 0} aria-label={`Position de : ${item.label}, entre ${board.low.label} (en bas) et ${board.high.label} (en haut)`} aria-orientation="vertical"
          aria-valuemin={0} aria-valuemax={100} aria-valuenow={pos} aria-disabled={checked}
          className="absolute inset-y-0 left-0 w-[112px] cursor-ns-resize touch-none select-none rounded-lg outline-offset-4"
          onPointerDown={(e) => { if (checked) return; dragging.current = true; e.currentTarget.setPointerCapture(e.pointerId); fromPointer(e.clientY); }}
          onPointerMove={(e) => { if (dragging.current && !checked) fromPointer(e.clientY); }}
          onPointerUp={() => { dragging.current = false; }}
          onPointerCancel={() => { dragging.current = false; }}
          onKeyDown={(e) => {
            if (checked) return;
            const step = e.key === "ArrowUp" || e.key === "ArrowRight" ? 1 : e.key === "ArrowDown" || e.key === "ArrowLeft" ? -1 : e.key === "PageUp" ? 10 : e.key === "PageDown" ? -10 : 0;
            if (step) { e.preventDefault(); setPos((p) => clamp(p + step)); }
          }}
        >
          <div ref={track} className="absolute inset-x-0 bottom-[16px] top-[16px]">
            <span aria-hidden className="absolute bottom-0 left-[84px] top-0 w-[3px] -translate-x-1/2 rounded bg-line-strong" />
            {board.ticks.map((t) => (
              <span key={t.pos} aria-hidden className="absolute left-0 flex w-[90px] translate-y-1/2 items-center justify-end gap-1.5 whitespace-nowrap" style={{ bottom: `${t.pos}%` }}>
                <span className="font-mono text-[10px] text-muted">{t.label}</span>
                <span className="h-px w-3 bg-line-strong" />
              </span>
            ))}
            {known.map((k) => <Dot key={k.key} pos={k.pos} tone="ink" />)}
            <Dot pos={pos} tone={checked ? (right ? "good" : "ghost") : "accent"} big={!checked}>{checked ? "" : "?"}</Dot>
          </div>
        </div>
        {/* Traits de rappel entre un point et son étiquette, quand elle a dû s'écarter. */}
        <svg aria-hidden className="pointer-events-none absolute left-[92px] top-0" width="22" height={RULER + 32}>
          {known.map((k, n) => <line key={k.key} x1="0" y1={16 + (1 - k.pos / 100) * RULER} x2="22" y2={16 + tops[n]} className="stroke-line-strong" strokeWidth="1" />)}
        </svg>
        <ul className="absolute inset-y-0 left-[120px] right-0">
          {known.map((k, n) => {
            const fresh = checked && k.key === item.label;
            return (
              <li key={k.key} className="absolute inset-x-0 -translate-y-1/2 leading-tight" style={{ top: 16 + tops[n] }}>
                <span className={`block truncate text-sm font-semibold ${fresh ? "text-accent" : ""}`}>{k.label}</span>
                <span className="block truncate text-xs text-muted">{k.caption && <span className="font-semibold uppercase tracking-wide">{k.caption} · </span>}{k.display}</span>
              </li>
            );
          })}
        </ul>
      </div>
      <p className="mt-3 text-xs text-muted">
        {board.log
          ? "Règle à puissances de dix : la même distance multiplie toujours par le même nombre."
          : "Règle régulière : la même distance ajoute toujours la même quantité."}
      </p>
    </section>
  );
}

function Dot({ pos, tone, big = false, children }: { pos: number; tone: "ink" | "accent" | "good" | "ghost"; big?: boolean; children?: React.ReactNode }) {
  const skin = tone === "accent" ? "h-8 w-8 bg-accent text-white shadow"
    : tone === "good" ? "h-6 w-6 bg-accent-soft ring-2 ring-accent"
    : tone === "ghost" ? "h-6 w-6 border-2 border-dashed border-line-strong bg-white"
    : "h-3.5 w-3.5 bg-ink ring-2 ring-white";
  return (
    <span aria-hidden className={`absolute left-[84px] flex -translate-x-1/2 translate-y-1/2 items-center justify-center rounded-full font-mono text-sm font-bold ${big ? "z-10" : ""} ${skin}`} style={{ bottom: `${pos}%` }}>
      {children}
    </span>
  );
}

// ───────────────────────────── Dessine la courbe ─────────────────────────────

const W = 340, H = 250, LEFT = 46, RIGHT = 14, TOP = 12, BOTTOM = 30;
const PLOT_W = W - LEFT - RIGHT, PLOT_H = H - TOP - BOTTOM;

function formatter(curve: Curve) {
  const step = (curve.yMax - curve.yMin) / 4;
  const digits = step < 1 ? 1 : Number.isInteger(step) ? 0 : 1;
  const nf = new Intl.NumberFormat("fr-FR", { minimumFractionDigits: 0, maximumFractionDigits: step < 1 ? 2 : 1 });
  const axis = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: digits });
  return { value: (v: number) => nf.format(v).replace("-", "−"), axis: (v: number) => axis.format(v).replace("-", "−") };
}

export function CourbeGame({ seed, themeNames, isMember, outcome, onFinish, onReplay, onExit }: VisualGameProps) {
  const [curves] = useState<Curve[]>(() => courbeGame(seed));
  const [c, setC] = useState(0);
  const [ys, setYs] = useState<(number | null)[]>(() => Array(curves[0] ? toDraw(curves[0]) : 0).fill(null));
  const [checked, setChecked] = useState(false);
  const [all, setAll] = useState<number[][]>([]);
  const [score, setScore] = useState(0);
  const drawing = useRef(false);
  useEffect(backToTop, []);
  const total = curves.reduce((n, curve) => n + toDraw(curve), 0);

  if (c >= curves.length) {
    return <EndScreen title="Dessine la courbe" score={score} total={total} unit="points tracés dans la bonne zone" outcome={outcome} isMember={isMember} onReplay={onReplay} onExit={onExit} />;
  }

  const curve = curves[c];
  const fmt = formatter(curve);
  const [x0, x1] = [curve.points[0][0], curve.points[curve.points.length - 1][0]];
  const px = (year: number) => LEFT + ((year - x0) / (x1 - x0)) * PLOT_W;
  const py = (pos: number) => TOP + (1 - pos / 100) * PLOT_H;
  const truth = curve.points.map(([year, value]) => ({ x: px(year), y: py(height(curve, value)), year, value }));
  const drawn = ys.map((y, k) => (y === null ? null : { x: truth[curve.given + k].x, y: py(y), pos: y }));
  const complete = ys.every((y) => y !== null);
  const marks = ys.map((y, k) => y !== null && Math.abs(y - height(curve, curve.points[curve.given + k][1])) <= COURBE_TOLERANCE);
  const lastGiven = truth[curve.given - 1];
  const path = (pts: { x: number; y: number }[]) => pts.map((p, k) => `${k ? "L" : "M"}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(" ");

  const fromPointer = (e: React.PointerEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * W;
    const y = ((e.clientY - rect.top) / rect.height) * H;
    let nearest = 0;
    for (let k = 1; k < ys.length; k++) if (Math.abs(truth[curve.given + k].x - x) < Math.abs(truth[curve.given + nearest].x - x)) nearest = k;
    const pos = clamp((100 * (TOP + PLOT_H - y)) / PLOT_H);
    setYs((prev) => prev.map((v, k) => (k === nearest ? pos : v)));
  };
  const validate = () => {
    setChecked(true);
    setScore((s) => s + marks.filter(Boolean).length);
  };
  const next = () => {
    const done = [...all, ys.map((y) => y ?? 0)];
    setAll(done);
    if (c + 1 === curves.length) onFinish(done);
    else setYs(Array(toDraw(curves[c + 1])).fill(null));
    setC((x) => x + 1);
    setChecked(false);
    backToTop();
  };

  return (
    <section id="jeu" className="card scroll-mt-20 p-5 sm:p-6 lg:scroll-mt-6">
      <Head title="Dessine la courbe" step={c} total={curves.length} theme={themeNames.get(curve.theme) ?? curve.theme} subject={curve.title} />
      {!checked && (
        <p className="mt-1 text-sm text-soft">
          {curve.given > 1 ? "Les premiers points sont donnés" : "Le premier point est donné"} : tracez la suite au doigt ou à la souris, de gauche à droite.
        </p>
      )}
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Graphique : ${curve.title}, en ${curve.unit}`}
        className={`mt-3 w-full max-w-[560px] select-none rounded-lg bg-paper ${checked ? "" : "cursor-crosshair touch-none"}`}
        onPointerDown={(e) => { if (checked) return; drawing.current = true; e.currentTarget.setPointerCapture(e.pointerId); fromPointer(e); }}
        onPointerMove={(e) => { if (drawing.current && !checked) fromPointer(e); }}
        onPointerUp={() => { drawing.current = false; }}
        onPointerCancel={() => { drawing.current = false; }}
      >
        {[0, 25, 50, 75, 100].map((pos) => (
          <g key={pos}>
            <line x1={LEFT} x2={W - RIGHT} y1={py(pos)} y2={py(pos)} className="stroke-line" strokeWidth={pos === 0 ? 1.2 : 0.6} />
            <text x={LEFT - 6} y={py(pos) + 3} textAnchor="end" className="fill-muted font-mono" fontSize="9">{fmt.axis(valueAt(curve, pos))}</text>
          </g>
        ))}
        <text x={LEFT} y={TOP - 2} className="fill-muted font-mono" fontSize="8">{curve.unit}</text>
        {truth.map((p, k) => (
          <g key={p.year}>
            {k >= curve.given && <line x1={p.x} x2={p.x} y1={TOP} y2={TOP + PLOT_H} className="stroke-line-strong" strokeWidth="0.6" strokeDasharray="2 3" />}
            <text x={p.x} y={H - 10} textAnchor="middle" className="fill-muted font-mono" fontSize="9">{truth.length > 7 && k % 2 === 1 ? "" : p.year}</text>
          </g>
        ))}
        {/* Tracé du joueur, raccordé au dernier point donné. */}
        <path d={path([lastGiven, ...drawn.filter((p) => p !== null)])} fill="none" className="stroke-accent" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" strokeDasharray={checked ? "4 4" : undefined} opacity={checked ? 0.75 : 1} />
        {drawn.map((p, k) => p && <circle key={k} cx={p.x} cy={p.y} r={checked ? 3 : 4.5} className={checked && !marks[k] ? "fill-white stroke-accent" : "fill-accent"} strokeWidth="1.5" />)}
        {/* La vraie courbe : les points donnés d'abord, tout après la validation. */}
        <path d={path(checked ? truth : truth.slice(0, curve.given))} fill="none" className="stroke-ink" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
        {(checked ? truth : truth.slice(0, curve.given)).map((p) => <circle key={p.year} cx={p.x} cy={p.y} r="3.6" className="fill-ink" />)}
      </svg>

      {!checked ? (
        <>
          <details className="mt-3 text-sm">
            <summary className="cursor-pointer text-soft">Régler point par point</summary>
            <ul className="mt-2 space-y-2">
              {ys.map((y, k) => {
                const year = curve.points[curve.given + k][0];
                return (
                  <li key={year} className="flex items-center gap-3">
                    <label htmlFor={`courbe-${c}-${k}`} className="w-12 shrink-0 font-mono text-xs">{year}</label>
                    <input id={`courbe-${c}-${k}`} type="range" min={0} max={100} value={y ?? 50} className="min-w-0 flex-1 accent-[rgb(var(--c-accent))]"
                      onChange={(e) => { const v = Number(e.target.value); setYs((prev) => prev.map((old, j) => (j === k ? v : old))); }} />
                    <span className="w-24 shrink-0 text-right text-xs text-muted">{y === null ? "—" : `${fmt.value(valueAt(curve, y))} ${curve.unit}`}</span>
                  </li>
                );
              })}
            </ul>
          </details>
          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" disabled={!complete} onClick={validate} className="btn-primary">Voir la vraie courbe</button>
            {ys.some((y) => y !== null) && <button type="button" onClick={() => setYs((prev) => prev.map(() => null))} className="btn-secondary">Effacer</button>}
          </div>
        </>
      ) : (
        <div aria-live="polite">
          <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-0.5 w-5 bg-ink" />la vraie courbe</span>
            <span className="inline-flex items-center gap-1.5"><span aria-hidden className="h-0 w-5 border-t-2 border-dashed border-accent" />votre tracé</span>
          </p>
          <p className="mt-2 text-sm text-soft">
            <span className={`font-bold ${marks.every(Boolean) ? "text-accent" : "text-ink"}`}>
              {marks.every(Boolean) ? "Tracé parfait !" : `${marks.filter(Boolean).length} point${marks.filter(Boolean).length > 1 ? "s" : ""} sur ${marks.length} dans la bonne zone.`}
            </span>{" "}
            {curve.explain}
          </p>
          <ul className="mt-3 grid grid-cols-1 gap-x-6 gap-y-1 text-xs sm:grid-cols-2">
            {curve.points.slice(curve.given).map(([year, value], k) => (
              <li key={year} className="flex items-baseline gap-2">
                <span className="w-10 shrink-0 font-mono font-bold">{year}</span>
                <span className="min-w-0 flex-1">{fmt.value(value)} {curve.unit}</span>
                <span className={`shrink-0 ${marks[k] ? "font-semibold text-accent" : "text-muted"}`}>vous : {fmt.value(valueAt(curve, ys[k] ?? 0))}</span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">Source : {curve.source}.</p>
          <button type="button" onClick={next} className="btn-primary mt-4">{c + 1 < curves.length ? "Courbe suivante" : "Voir mon score"}</button>
        </div>
      )}
    </section>
  );
}

// ───────────────────────────── La frise ─────────────────────────────

/** La frise : glisser les événements dans l'ordre sur la ligne du temps (ou les monter et descendre avec les flèches). */
export function FriseGame({ seed, themeNames, isMember, outcome, onFinish, onReplay, onExit }: VisualGameProps) {
  const [frises] = useState<Frise[]>(() => friseGame(seed));
  const [step, setStep] = useState(0);
  /** Index des événements (dans frise.events), du haut (le plus ancien) vers le bas. */
  const [order, setOrder] = useState<number[]>(() => (frises[0]?.events ?? []).map((_, k) => k));
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  const [all, setAll] = useState<number[][]>([]);
  const [held, setHeld] = useState<number | null>(null);
  const list = useRef<HTMLOListElement>(null);
  const drag = useRef<{ event: number; pointerY: number; grab: number } | null>(null);
  const total = frises.length * FRISE_EVENTS;

  // La carte tenue suit le doigt : son décalage est recalculé après chaque réordonnancement.
  const follow = () => {
    const d = drag.current;
    const ol = list.current;
    if (!d || !ol) return;
    const el = ol.querySelector<HTMLElement>(`[data-event="${d.event}"]`);
    if (!el) return;
    const top = ol.getBoundingClientRect().top + el.offsetTop;
    el.style.transform = `translateY(${d.pointerY - d.grab - top}px)`;
  };
  useLayoutEffect(follow);
  useEffect(backToTop, []);

  if (step >= frises.length) {
    return <EndScreen title="La frise" score={score} total={total} unit="événements à la bonne place" outcome={outcome} isMember={isMember} onReplay={onReplay} onExit={onExit} />;
  }

  const frise = frises[step];
  const rightCount = order.filter((k, slot) => frise.events[k] === frise.solution[slot]).length;
  const move = (from: number, to: number) => setOrder((o) => {
    if (to < 0 || to >= o.length || from === to) return o;
    const copy = [...o];
    copy.splice(to, 0, copy.splice(from, 1)[0]);
    return copy;
  });

  // Le glisser est suivi sur la fenêtre, pas sur la poignée : React déplace la carte dans la page à chaque
  // changement de rang, et un doigt posé sur un élément déplacé cesse de lui envoyer ses mouvements.
  const dragMove = (clientY: number) => {
    const d = drag.current;
    const ol = list.current;
    if (!d || !ol) return;
    d.pointerY = clientY;
    const olTop = ol.getBoundingClientRect().top;
    const items = [...ol.querySelectorAll<HTMLElement>("[data-event]")];
    const from = items.findIndex((el) => el.dataset.event === String(d.event));
    if (from < 0) return;
    const centre = clientY - d.grab + items[from].offsetHeight / 2;
    // Rang visé : nombre d'autres cartes dont le milieu est au-dessus du milieu de la carte tenue.
    let to = 0;
    items.forEach((el, k) => { if (k !== from && olTop + el.offsetTop + el.offsetHeight / 2 < centre) to++; });
    if (to !== from) move(from, to); else follow();
  };
  const startDrag = (event: number, clientY: number, li: HTMLElement) => {
    drag.current = { event, pointerY: clientY, grab: clientY - li.getBoundingClientRect().top };
    setHeld(event);
    const onMove = (e: PointerEvent) => dragMove(e.clientY);
    const onEnd = () => {
      const el = list.current?.querySelector<HTMLElement>(`[data-event="${event}"]`);
      if (el) el.style.transform = "";
      drag.current = null;
      setHeld(null);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
  };

  const validate = () => {
    setChecked(true);
    setScore((s) => s + rightCount);
    setAll((p) => [...p, order]);
  };
  const next = () => {
    if (step + 1 === frises.length) onFinish(all);
    else setOrder(frises[step + 1].events.map((_, k) => k));
    setStep((s) => s + 1);
    setChecked(false);
    backToTop();
  };

  return (
    <section id="jeu" className="card scroll-mt-20 p-5 sm:p-6 lg:scroll-mt-6">
      <Head title="La frise" step={step} total={frises.length} theme={themeNames.get(frise.theme) ?? frise.theme} subject={frise.title} />
      {!checked ? (
        <p className="mt-1 text-sm text-soft">Glissez les événements par leur poignée pour les ranger du plus ancien (en haut) au plus récent (en bas).</p>
      ) : (
        <p aria-live="polite" className="mt-2 text-sm text-soft">
          <span className={`font-bold ${rightCount === order.length ? "text-accent" : "text-ink"}`}>
            {rightCount === order.length ? "Ordre parfait !" : `${rightCount} sur ${order.length} à la bonne place.`}
          </span>{" "}
          Voici la chronologie :
        </p>
      )}

      <p className="label-mono mt-4 pl-9">Le plus ancien</p>
      <ol ref={list} className="relative mt-2 select-none space-y-2 before:absolute before:bottom-3 before:left-[13px] before:top-3 before:w-0.5 before:bg-line-strong">
        {(checked ? frise.solution.map((event) => frise.events.indexOf(event)) : order).map((k, slot) => {
          const event = frise.events[k];
          const ok = checked && order[slot] === k;
          return (
            <li key={event.label} data-event={k}
              className={`relative flex items-stretch gap-2 pl-9 ${held === k ? "z-10" : "transition-transform duration-150"}`}>
              <span aria-hidden className={`absolute left-[6px] top-1/2 h-4 w-4 -translate-y-1/2 rounded-full ring-4 ring-white ${checked ? (ok ? "bg-accent" : "bg-ink") : "bg-line-strong"}`} />
              <div className={`flex min-w-0 flex-1 items-center gap-2 rounded-lg bg-white px-2 py-2 text-[15px] ${checked ? (ok ? "bg-accent-soft ring-2 ring-accent" : "ring-1 ring-line") : held === k ? "shadow-lg ring-2 ring-accent" : "ring-1 ring-line"}`}>
                {checked ? (
                  <span className="w-12 shrink-0 pl-1 font-mono text-sm font-bold">{event.display}</span>
                ) : (
                  <button type="button" aria-label={`Déplacer : ${event.label}`}
                    className="flex h-11 w-9 shrink-0 cursor-grab touch-none items-center justify-center rounded-md text-muted hover:bg-chip active:cursor-grabbing"
                    onPointerDown={(e) => {
                      e.preventDefault(); // pas de sélection de texte pendant le glisser
                      startDrag(k, e.clientY, e.currentTarget.closest("li") as HTMLElement);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "ArrowUp") { e.preventDefault(); move(slot, slot - 1); }
                      if (e.key === "ArrowDown") { e.preventDefault(); move(slot, slot + 1); }
                    }}>
                    <svg width="14" height="20" viewBox="0 0 14 20" aria-hidden className="fill-current"><circle cx="4" cy="4" r="1.6" /><circle cx="10" cy="4" r="1.6" /><circle cx="4" cy="10" r="1.6" /><circle cx="10" cy="10" r="1.6" /><circle cx="4" cy="16" r="1.6" /><circle cx="10" cy="16" r="1.6" /></svg>
                  </button>
                )}
                <span className="min-w-0 flex-1 py-1 leading-snug">{event.label}</span>
                {checked ? (
                  <span className="shrink-0 pr-1 text-xs text-muted">{ok ? "bien placé" : `vous : ${order.indexOf(k) + 1}ᵉ`}</span>
                ) : (
                  <span className="flex shrink-0 flex-col">
                    <button type="button" aria-label={`Monter : ${event.label}`} disabled={slot === 0} onClick={() => move(slot, slot - 1)} className="flex h-6 w-8 items-center justify-center rounded text-muted hover:bg-chip hover:text-ink disabled:opacity-30">▲</button>
                    <button type="button" aria-label={`Descendre : ${event.label}`} disabled={slot === order.length - 1} onClick={() => move(slot, slot + 1)} className="flex h-6 w-8 items-center justify-center rounded text-muted hover:bg-chip hover:text-ink disabled:opacity-30">▼</button>
                  </span>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      <p className="label-mono mt-2 pl-9">Le plus récent</p>

      <button type="button" onClick={checked ? next : validate} className="btn-primary mt-4">
        {!checked ? "Valider l’ordre" : step + 1 < frises.length ? "Frise suivante" : "Voir mon score"}
      </button>
    </section>
  );
}

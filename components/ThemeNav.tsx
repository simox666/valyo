"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { ThemeTile } from "./ThemeTile";

type Tile = { slug: string; name: string; href: string; mine: boolean };

/**
 * Cases de thèmes du fil. Réponse immédiate au clic : la case choisie s'allume tout de suite
 * et le fil s'estompe pendant le chargement (attribut data-nav-pending sur <body>).
 */
export function ThemeNav({ tiles, allHref, current, mineCount }: { tiles: Tile[]; allHref: string; current: string | null; mineCount: number }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [chosen, setChosen] = useState<string | null>(current);
  useEffect(() => setChosen(current), [current]);
  useEffect(() => {
    if (pending) document.body.dataset.navPending = "1";
    else delete document.body.dataset.navPending;
  }, [pending]);

  function go(event: React.MouseEvent, slug: string | null, href: string) {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;
    event.preventDefault();
    setChosen(slug);
    startTransition(() => router.push(href, { scroll: false }));
  }

  return (
    <nav aria-label="Filtrer par thème" aria-busy={pending} className="relative -mx-4 flex gap-1.5 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0">
      <Link href={allHref} onClick={(e) => go(e, null, allHref)} aria-current={!chosen ? "page" : undefined} title="Tous les thèmes"
        className={`flex h-14 w-14 shrink-0 flex-col justify-between rounded-md p-[5px] ${!chosen ? "bg-ink text-white" : "bg-white ring-1 ring-[#D3D3CA] hover:ring-ink"}`}>
        <span className="font-mono text-[9px] leading-none">0</span>
        <span className="font-display text-xl font-bold leading-none">∗</span>
        <span className="text-[9px] leading-none">Tout</span>
      </Link>
      {tiles.map((t, i) => (
        <span key={t.slug} className="flex shrink-0 gap-1.5">
          {i === mineCount && mineCount > 0 && <span aria-hidden className="mx-1 w-px self-stretch bg-line" />}
          <Link href={t.href} onClick={(e) => go(e, t.slug, t.href)} aria-current={chosen === t.slug ? "page" : undefined}
            title={t.mine ? `${t.name} — un de vos thèmes` : t.name}
            className={`relative rounded-md ${t.mine && chosen !== t.slug ? "ring-2 ring-accent" : "hover:ring-1 hover:ring-ink"}`}>
            <ThemeTile slug={t.slug} name={t.name} size="lg" active={chosen === t.slug} />
            {t.mine && <span aria-hidden className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-accent" />}
            <span className="sr-only">{t.name}{t.mine ? " (un de vos thèmes)" : ""}</span>
          </Link>
        </span>
      ))}
    </nav>
  );
}

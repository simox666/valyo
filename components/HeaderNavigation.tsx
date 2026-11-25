"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { LogoutButton } from "./LogoutButton";
import { Avatar } from "./Avatar";
import { ProgressMini, ProgressToast, useProgress } from "./Progress";

export function HeaderNavigation({ user, initialUnread, initialMessages }: {
  user: { handle: string | null; displayName: string; avatarId: string | null; onboarded: boolean; isAdmin: boolean; canPublish: boolean } | null;
  initialUnread: number;
  initialMessages: number;
}) {
  const pathname = usePathname();
  const [unread, setUnread] = useState(initialUnread);
  const [messages, setMessages] = useState(initialMessages);
  const progress = useProgress(Boolean(user?.onboarded), pathname);
  useEffect(() => { setUnread(initialUnread); }, [initialUnread]);
  useEffect(() => { setMessages(initialMessages); }, [initialMessages]);
  useEffect(() => {
    if (!user?.onboarded) return;
    const controller = new AbortController();
    async function refresh() {
      if (document.visibilityState !== "visible") return;
      try {
        const response = await fetch("/api/notifications", { signal: controller.signal, cache: "no-store" });
        if (response.status === 401) { setUnread(0); return; }
        const data = await response.json();
        if (!controller.signal.aborted && response.ok && Number.isSafeInteger(data.unread)) setUnread(data.unread);
        const dm = await fetch("/api/messages", { signal: controller.signal, cache: "no-store" });
        const dmData = await dm.json();
        if (!controller.signal.aborted && dm.ok && Number.isSafeInteger(dmData.unread)) setMessages(dmData.unread);
      } catch { /* Une panne de réseau ne remplace pas un compteur connu par zéro. */ }
    }
    void refresh();
    const timer = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    window.addEventListener("valyo:notifications", refresh);
    window.addEventListener("valyo:messages", refresh);
    return () => { controller.abort(); clearInterval(timer); window.removeEventListener("focus", refresh); window.removeEventListener("valyo:notifications", refresh); window.removeEventListener("valyo:messages", refresh); };
  }, [pathname, user?.onboarded, user?.handle]);

  const followHref = user?.onboarded ? `/m/${user.handle}/abonnes` : "";
  const active = (href: string) => href === "/" ? pathname === "/"
    : href === "/salons" ? pathname.startsWith("/salons") || pathname.startsWith("/s/")
    : href === followHref ? /^\/m\/[^/]+\/(abonnes|abonnements)$/.test(pathname)
    : href.startsWith("/m/") ? pathname === href
    : pathname.startsWith(href);
  const next = encodeURIComponent(pathname);
  const profileHref = user?.onboarded ? `/m/${user.handle}` : `/connexion?next=${next}`;
  // `gap` : un peu d'air avant l'entrée, pour séparer les groupes (échanger, mon réseau, jouer, moi).
  const items: { href: string; label: string; icon: React.ReactNode; badge?: number; show: boolean; gap?: boolean }[] = [
    { href: "/", label: "Fil", icon: ICONS.home, show: true },
    { href: "/salons", label: "Salons", icon: ICONS.rooms, show: true },
    { href: "/messages", label: "Messages", icon: ICONS.messages, badge: messages, show: Boolean(user?.onboarded) },
    { href: followHref, label: "Mon réseau", icon: ICONS.people, show: Boolean(user?.onboarded), gap: true },
    { href: "/a-creuser", label: "À creuser", icon: ICONS.dig, show: Boolean(user?.onboarded) },
    { href: "/jeux", label: "Jeux", icon: ICONS.game, show: true, gap: true },
    { href: "/simulateurs", label: "Simulateurs", icon: ICONS.sim, show: true },
    { href: "/notifications", label: "Notifications", icon: ICONS.bell, badge: unread, show: Boolean(user?.onboarded), gap: true },
    { href: profileHref, label: "Profil", icon: ICONS.user, show: Boolean(user?.onboarded) },
  ];
  const Logo = () => (
    <Link href="/" aria-label="Valyo, accueil" className="flex items-baseline gap-2">
      <span className="font-display text-[26px] font-bold tracking-[-0.03em] text-ink">Valyo</span>
      <span className="font-mono text-[11px] text-accent">bêta</span>
    </Link>
  );
  const Badge = ({ n }: { n?: number }) => n ? <span aria-label={`${n} non lu${n > 1 ? "s" : ""}`} className="ml-auto min-w-5 rounded-full bg-accent px-1.5 text-center text-[11px] font-semibold leading-5 text-white">{n}</span> : null;

  const accountMenu = user?.onboarded ? <AccountMenu user={user} pathname={pathname} />
    : user ? <Link href={`/bienvenue?next=${next}`} className="btn-primary px-3 py-2">Terminer l’inscription</Link>
    : <Link href={`/connexion?next=${next}`} className="btn-primary px-3 py-2">Se connecter</Link>;

  return <>
  {/* Ordinateur : menu vertical */}
  <aside aria-label="Menu Valyo" className="sticky top-0 hidden h-screen w-[190px] shrink-0 flex-col gap-0.5 py-7 lg:flex">
    <div className="px-2.5 pb-5">
      <Logo />
      <p className="mt-1.5 text-xs leading-snug text-muted">Le réseau social des passionnés de tech et de sciences : les Valyors.</p>
    </div>
    <form action="/recherche" role="search" className="relative mb-3">
      <label htmlFor="recherche-menu" className="sr-only">Rechercher sur Valyo</label>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted">{ICONS.search}</svg>
      <input id="recherche-menu" name="q" type="search" minLength={2} maxLength={100} placeholder="Rechercher…"
        className="h-10 w-full rounded-lg bg-white pl-9 pr-3 text-sm ring-1 ring-line placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent" />
    </form>
    <nav aria-label="Navigation principale" className="flex flex-col gap-0.5">
      {items.filter(i => i.show).map(i => (
        <Link key={i.label} href={i.href} aria-current={active(i.href) ? "page" : undefined}
          className={`flex items-center gap-3 rounded-lg px-2.5 py-2.5 text-[15px] ${i.gap ? "mt-3" : ""} ${active(i.href) ? "bg-white font-semibold text-ink ring-1 ring-line" : "text-soft hover:bg-white/70 hover:text-ink"}`}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active(i.href) ? 1.9 : 1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={active(i.href) ? "text-accent" : undefined}>{i.icon}</svg>
          {i.label}<Badge n={i.badge} />
        </Link>
      ))}
    </nav>
    {user?.canPublish && pathname !== "/" && <Link href="/publier" className="mt-5 flex h-11 items-center justify-center rounded-lg bg-ink text-[15px] font-semibold text-white hover:bg-black">Publier</Link>}
    {user?.onboarded && <ProgressMini data={progress} handle={user.handle} />}
    {user?.onboarded
      ? <div className="mt-auto">{accountMenu}</div>
      : <div className="mt-5 [&>a]:w-full">
          {accountMenu}
          {!user && <p className="mt-2 px-1 text-xs leading-snug text-muted">Un e-mail suffit : pas de mot de passe à retenir.</p>}
        </div>}
  </aside>
  <ProgressToast data={progress} />

  {/* Mobile : barre du haut */}
  <header className="sticky top-0 z-30 border-b border-line bg-paper/95 backdrop-blur lg:hidden">
    <div className="flex h-14 items-center gap-1.5 px-4">
      <div className="flex-1"><Logo /></div>
      {/* Visiteur : recherche et jeux sont dans les onglets du bas ; seuls les simulateurs ont besoin d'un accès ici. */}
      {!user?.onboarded && (
        <Link href="/simulateurs" aria-label="Simulateurs" aria-current={active("/simulateurs") ? "page" : undefined} className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-ink ring-1 ring-line">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{ICONS.sim}</svg>
        </Link>
      )}
      {user?.onboarded && <>
        <Link href="/recherche" aria-label="Rechercher" className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-ink ring-1 ring-line">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" aria-hidden>{ICONS.search}</svg>
        </Link>
        <Link href="/jeux" aria-label="Jeux" aria-current={active("/jeux") ? "page" : undefined} className="flex h-10 w-10 items-center justify-center rounded-lg bg-white text-ink ring-1 ring-line">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{ICONS.game}</svg>
        </Link>
      </>}
      {user?.onboarded && (
        <Link href="/messages" aria-label={`Messages${messages ? ` (${messages} non lus)` : ""}`} className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-white text-ink ring-1 ring-line">
          <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{ICONS.messages}</svg>
          {messages > 0 && <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] font-semibold leading-4 text-white">{messages}</span>}
        </Link>
      )}
      {accountMenu}
    </div>
  </header>

  {/* Mobile : onglets du bas */}
  <nav aria-label="Navigation mobile" className="fixed inset-x-0 bottom-0 z-20 grid h-[68px] grid-cols-5 items-center border-t border-line bg-white px-1 pb-[env(safe-area-inset-bottom)] text-xs lg:hidden">
    <TabLink href="/" label="Fil" active={active("/")}>{ICONS.home}</TabLink>
    <TabLink href="/salons" label="Salons" active={active("/salons")}>{ICONS.rooms}</TabLink>
    <Link href={user?.canPublish ? "/publier" : `/connexion?next=${encodeURIComponent("/publier")}`} aria-label="Publier" className="mx-auto flex h-12 w-12 items-center justify-center rounded-card bg-accent text-white">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden><path d="M12 5v14M5 12h14" /></svg>
    </Link>
    {user?.onboarded
      ? <TabLink href="/notifications" label="Notifs" active={active("/notifications")} badge={unread}>{ICONS.bell}</TabLink>
      : <TabLink href="/recherche" label="Chercher" active={active("/recherche")}>{ICONS.search}</TabLink>}
    {user?.onboarded
      ? <TabLink href={profileHref} label="Profil" active={Boolean(user.handle) && pathname.startsWith(`/m/${user.handle}`)}>{ICONS.user}</TabLink>
      : <TabLink href="/jeux" label="Jeux" active={active("/jeux")}>{ICONS.game}</TabLink>}
  </nav>
  </>;
}

// Un composant par emplacement (colonne ordinateur, barre mobile) : chacun a sa propre référence.
function AccountMenu({ user, pathname }: { user: { handle: string | null; displayName: string; avatarId: string | null; isAdmin: boolean }; pathname: string }) {
  const account = useRef<HTMLDetailsElement>(null);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (account.current) account.current.open = false;
  }, [pathname]);
  useEffect(() => {
    const close = (event: PointerEvent) => {
      if (account.current && !account.current.contains(event.target as Node)) account.current.open = false;
    };
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, []);
  return (
    <details ref={account} className="relative" onToggle={e => setOpen(e.currentTarget.open)} onKeyDown={e => {
      if (e.key === "Escape") { e.preventDefault(); e.currentTarget.open = false; e.currentTarget.querySelector("summary")?.focus(); }
    }} onBlur={e => {
      // Safari (iOS surtout) ne donne pas le focus au lien touché : relatedTarget vaut null et fermer ici
      // ferait disparaître le lien avant son clic. Le toucher hors du menu est géré par pointerdown.
      const next = e.relatedTarget as Node | null;
      if (next && !e.currentTarget.contains(next)) e.currentTarget.open = false;
    }}>
      <summary aria-expanded={open} className="flex h-10 cursor-pointer list-none items-center gap-2 rounded-lg px-2 text-sm font-medium text-soft hover:bg-white hover:text-ink lg:w-full [&::-webkit-details-marker]:hidden">
        <Avatar name={user.displayName || user.handle || "?"} seed={user.handle} size="xs" imageId={user.avatarId} />
        <span className="hidden truncate lg:inline">@{user.handle}</span>
        <span aria-hidden className="ml-auto text-xs">▾</span>
      </summary>
      <nav aria-label="Mon compte" className="absolute right-0 top-full z-30 mt-2 max-h-[calc(100dvh-5rem)] w-60 max-w-[calc(100vw-2rem)] overflow-y-auto rounded-card bg-white p-1.5 shadow-lg ring-1 ring-line lg:bottom-full lg:left-0 lg:right-auto lg:top-auto lg:mb-2" onClick={e => {
        if ((e.target as HTMLElement).closest("a")) { if (account.current) account.current.open = false; }
      }}>
        <Link href={`/m/${user.handle}`} className="account-link">Mon profil</Link>
        <Link href={`/m/${user.handle}/abonnes`} className="account-link">Mes abonnés</Link>
        <Link href={`/m/${user.handle}/abonnements`} className="account-link">Mes abonnements</Link>
        <Link href="/a-creuser" className="account-link">Ma liste « À creuser »</Link>
        <Link href="/jeux" className="account-link">Jeux</Link>
        <Link href="/simulateurs" className="account-link">Simulateurs</Link>
        <Link href="/inviter" className="account-link">Inviter des proches</Link>
        <Link href="/parametres" className="account-link">Paramètres</Link>
        <Link href="/avis" className="account-link">Votre avis sur la bêta</Link>
        <Link href="/sanctions" className="account-link">Sanctions et contestations</Link>
        {user.isAdmin && <><Link href="/admin/editorial" className="account-link">Administration</Link><Link href="/admin/moderation" className="account-link">Modération</Link><Link href="/admin/avis" className="account-link">Avis des testeurs</Link></>}
        <div className="mt-1 border-t border-line px-3 py-3"><LogoutButton /></div>
      </nav>
    </details>
  );
}

const ICONS = {
  home: <path d="M3 10.5 12 3l9 7.5V21h-6v-6H9v6H3z" />,
  explore: <><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2 5-5 2 2-5z" /></>,
  rooms: <><path d="M4 5h11a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z" /><path d="M19 9h1a2 2 0 0 1 2 2v6a2 2 0 0 1-2 2h-1v2l-3-2h-4" /></>,
  messages: <><path d="M3 6.5A2.5 2.5 0 0 1 5.5 4h13A2.5 2.5 0 0 1 21 6.5v9a2.5 2.5 0 0 1-2.5 2.5H8l-5 3z" /><path d="M7.5 9.5h9M7.5 13h6" /></>,
  bell: <><path d="M6 16V11a6 6 0 0 1 12 0v5l2 2H4z" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
  user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
  people: <><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20a6.5 6.5 0 0 1 13 0" /><path d="M16 4.5a3.5 3.5 0 0 1 0 7M18 14.2a6.5 6.5 0 0 1 3.5 5.8" /></>,
  search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></>,
  dig: <><path d="M6 3h12v18l-6-4-6 4z" /><circle cx="11.5" cy="9.5" r="2.5" /><path d="m13.5 11.5 1.5 1.5" /></>,
  sim: <><path d="M4 7h9M17 7h3M4 12h3M11 12h9M4 17h11M19 17h1" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="12" r="2" /><circle cx="17" cy="17" r="2" /></>,
  game: <><rect x="2.5" y="7" width="19" height="11" rx="4" /><path d="M7.5 10.5v4M5.5 12.5h4" /><path d="M15.5 11h.01M18 13.5h.01" /></>,
};

function TabLink({ href, label, active, badge = 0, children }: { href: string; label: string; active: boolean; badge?: number; children: React.ReactNode }) {
  return <Link href={href} aria-current={active ? "page" : undefined} className={`relative flex flex-col items-center gap-0.5 py-1 ${active ? "font-semibold text-ink" : "text-muted"}`}>
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={active ? 1.9 : 1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={active ? "text-accent" : undefined}>{children}</svg>
    {label}
    {badge > 0 && <span aria-label={`${badge} non lues`} className="absolute right-[22%] top-0 min-w-4 rounded-full bg-accent px-1 text-center text-[10px] leading-4 text-white">{badge}</span>}
  </Link>;
}

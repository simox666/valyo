import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getCurrentUser, safeNextPath } from "@/lib/auth";
import { db } from "@/lib/db";
import { firstSteps } from "@/lib/social/suggestions.ts";
import { Avatar } from "@/components/Avatar";
import { FollowButton } from "@/components/FollowButton";
import { LocalTime } from "@/components/LocalTime";
import { JoinButton } from "@/app/s/[id]/RoomActions";

export const metadata: Metadata = { title: "Premiers pas", robots: { index: false } };

// Premiers pas d'un nouveau membre : trois façons d'échanger avec quelqu'un dès
// aujourd'hui (rejoindre un salon, répondre à une question, suivre un membre).
// Uniquement des données réelles ; état vide honnête quand la communauté démarre.
export default async function FirstStepsPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = safeNextPath((await searchParams).next);
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=${encodeURIComponent("/bienvenue/premiers-pas")}`);
  if (!user.onboarded) redirect(`/bienvenue?next=${encodeURIComponent("/bienvenue/premiers-pas")}`);
  const steps = await firstSteps(db.query, user.id);
  const canAct = user.status === "active";
  const done = [steps.progress.joinedRoom, steps.progress.repliedOrPosted, steps.progress.followsMember];
  const doneCount = done.filter(Boolean).length;
  const nothingYet = steps.rooms.length + steps.questions.length + steps.members.length === 0;

  const Check = ({ ok, label }: { ok: boolean; label: string }) => (
    <li className="flex items-center gap-2">
      <span aria-hidden className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-sm font-bold ${ok ? "bg-white text-accent" : "border-2 border-white/60"}`}>
        {ok ? "✓" : ""}
      </span>
      <span className={ok ? "text-white/75 line-through decoration-white/50" : "font-semibold"}>{label}</span>
      <span className="sr-only">{ok ? "(fait)" : "(à faire)"}</span>
    </li>
  );

  return (
    <div className="wide-page space-y-6">
      <header className="rounded-card bg-ink p-5 text-white sm:p-6">
        <p className="label-mono text-white/70">Premiers pas</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">Bienvenue, {user.displayName ?? user.handle} !</h1>
        <p className="mt-2 max-w-2xl text-white/85">
          Valyo, c’est surtout les échanges. Voici trois façons de rejoindre la conversation dès aujourd’hui
          {steps.themeNames.length ? <> — en commençant par vos thèmes : {steps.themeNames.join(", ")}.</> : "."}
        </p>
        <div className="mt-5 rounded-card bg-white/10 p-4">
          <p className="text-sm font-semibold">{doneCount === 3 ? "Bravo, vous êtes lancé·e !" : `${doneCount} sur 3`}</p>
          <ol className="mt-3 grid gap-2 text-sm sm:grid-cols-3">
            <Check ok={done[0]} label="Rejoindre un salon" />
            <Check ok={done[1]} label="Répondre ou publier" />
            <Check ok={done[2]} label="Suivre un membre" />
          </ol>
        </div>
      </header>

      {!steps.progress.repliedOrPosted && (
        <section className="card flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6">
          <div className="min-w-0">
            <h2 className="text-lg font-bold">Présentez-vous à la communauté</h2>
            <p className="mt-1 max-w-xl text-sm text-soft">
              Qui vous êtes, ce qui vous passionne, ce qu’on peut vous demander. Les membres de vos thèmes viendront vous souhaiter la bienvenue.
            </p>
          </div>
          <Link href="/publier?modele=presentation" className="btn-primary shrink-0">Je me présente →</Link>
        </section>
      )}

      {nothingYet ? (
        <section className="card space-y-3 p-6">
          <h2 className="text-lg font-bold">La communauté démarre : vous faites partie des premiers.</h2>
          <p className="text-soft">
            Il n’y a pas encore d’échange récent à vous proposer. C’est le moment idéal pour lancer le premier sujet : une question attire
            souvent les premières réponses.
          </p>
          <div className="flex flex-wrap gap-3">
            <Link href="/publier" className="btn-primary">Poser une question</Link>
            <Link href="/salons/nouveau" className="btn-secondary">Créer un salon</Link>
          </div>
        </section>
      ) : (
        <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
          <section className="card p-5 sm:p-6 lg:col-span-2" aria-labelledby="pp-questions">
            <p className="label-mono text-accent">1 · Le plus simple</p>
            <h2 id="pp-questions" className="mt-1 text-lg font-bold">Des questions attendent une réponse</h2>
            <p className="mt-1 text-sm text-soft">Partager ce que vous savez, même brièvement, est la meilleure façon de rencontrer quelqu’un ici.</p>
            {steps.questions.length ? (
              <ul className="mt-3 divide-y divide-line">
                {steps.questions.map((q) => (
                  <li key={q.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div className="min-w-0">
                      <Link href={`/p/${q.id}`} className="font-bold leading-snug hover:underline">{q.title}</Link>
                      <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-soft">
                        <span>{q.authorName}</span>
                        <span aria-hidden>·</span>
                        <LocalTime iso={q.createdAt} />
                        <span aria-hidden>·</span>
                        <span className={q.replies === 0 ? "font-semibold text-accent" : ""}>
                          {q.replies === 0 ? "Pas encore de réponse" : `${q.replies} réponse${q.replies > 1 ? "s" : ""}`}
                        </span>
                        {q.themeNames.map((t) => <span key={t} className="chip">{t}</span>)}
                      </p>
                    </div>
                    <Link href={`/p/${q.id}#commentaires`} className="btn-primary shrink-0">Répondre</Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-soft">
                Aucune question récente sans vous. <Link href="/publier" className="btn-link">Posez la vôtre →</Link>
              </p>
            )}
          </section>

          <section className="card p-5 sm:p-6" aria-labelledby="pp-salons">
            <p className="label-mono text-accent">2 · À plusieurs</p>
            <h2 id="pp-salons" className="mt-1 text-lg font-bold">Des salons actifs à rejoindre</h2>
            <p className="mt-1 text-sm text-soft">Des discussions de groupe qui ont eu lieu ces deux dernières semaines.</p>
            {steps.rooms.length ? (
              <ul className="mt-3 divide-y divide-line">
                {steps.rooms.map((r) => (
                  <li key={r.id} className="space-y-2 py-3">
                    <div>
                      <Link href={`/s/${r.id}`} className="font-bold text-accent hover:underline">{r.name}</Link>
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {r.themeName && <span className="chip">{r.themeName}</span>}
                        {r.matchesTheme && <span className="chip bg-accent-soft text-accent">Votre thème</span>}
                      </div>
                      {r.description && <p className="mt-1 text-sm text-soft">{r.description}</p>}
                      <p className="mt-1 text-xs text-soft">
                        {r.members} membre{r.members > 1 ? "s" : ""} · {r.recentMessages} message{r.recentMessages > 1 ? "s" : ""} sur 7 jours
                      </p>
                    </div>
                    {canAct && <JoinButton roomId={r.id} openChat />}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-soft">
                Pas de salon actif à vous proposer pour l’instant. <Link href="/salons" className="btn-link">Voir tous les salons →</Link>
              </p>
            )}
          </section>

          <section className="card p-5 sm:p-6" aria-labelledby="pp-membres">
            <p className="label-mono text-accent">3 · Des personnes</p>
            <h2 id="pp-membres" className="mt-1 text-lg font-bold">Des membres actifs à suivre</h2>
            <p className="mt-1 text-sm text-soft">Leurs publications remonteront dans votre fil « Pour vous ».</p>
            {steps.members.length ? (
              <ul className="mt-3 divide-y divide-line">
                {steps.members.map((m) => (
                  <li key={m.handle} className="flex flex-wrap items-start justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <Avatar name={m.displayName} seed={m.handle} size="md" />
                      <div className="min-w-0">
                        <Link href={`/m/${m.handle}`} className="font-bold hover:underline">{m.displayName}</Link>
                        <p className="text-xs text-soft">
                          @{m.handle} · {m.contributions} contribution{m.contributions > 1 ? "s" : ""} en 2 semaines
                        </p>
                        {m.sharedThemes.length > 0 && <p className="mt-1 text-xs font-semibold text-accent">Aime aussi : {m.sharedThemes.join(", ")}</p>}
                        {m.bio && <p className="mt-1 line-clamp-2 text-sm text-soft">{m.bio}</p>}
                      </div>
                    </div>
                    {canAct && <FollowButton target="member" keyValue={m.handle} initialFollowing={false} signedIn label="" />}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="mt-3 text-sm text-soft">Personne d’actif à vous suggérer pour l’instant : vos premières contributions feront venir les autres.</p>
            )}
          </section>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
        <p className="text-sm text-soft">Vous retrouverez ces suggestions depuis l’accueil pendant votre première semaine.</p>
        <Link href={next} className="btn-secondary">{next === "/" ? "Aller au fil →" : "Continuer →"}</Link>
      </div>
    </div>
  );
}

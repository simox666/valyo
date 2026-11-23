import type { Metadata } from "next";
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import { db } from "@/lib/db";
import { listFeed } from "@/lib/data/posts";
import { reactionSummaries } from "@/lib/social/reactions.ts";
import { FollowButton } from "@/components/FollowButton";
import { PostCard } from "@/components/PostCard";
import { RecapArticle, type RecapItemView } from "@/components/RecapArticle";

export const metadata: Metadata = {
  title: "Le récap sciences & tech",
  description: "Trois fois par semaine, l'essentiel des nouvelles en IA, robotique et espace, avec leurs sources.",
  alternates: { canonical: "/recap" },
};

// Exemple de PRÉSENTATION, clairement étiqueté fictif : jamais présenté comme une nouvelle
// réelle, jamais enregistré en base. Il disparaît de la page dès qu'un vrai récapitulatif
// est publié.
const EXEMPLE: RecapItemView[] = [
  {
    id: "exemple-1",
    position: 1,
    title: "Exemple — Un laboratoire présente un robot capable de trier des composants",
    summary:
      "Exemple fictif de présentation. Chaque nouvelle tient en quelques phrases fidèles à la source, avec son statut : annonce, prépublication non relue ou résultat publié.",
    scientificStatus: "announcement",
    sources: [{ url: "https://exemple.invalid/annonce", title: "Source d'exemple" }],
    correction: null,
    developmentPostId: null,
  },
  {
    id: "exemple-2",
    position: 2,
    title: "Exemple — Une prépublication décrit une nouvelle méthode d'apprentissage",
    summary:
      "Exemple fictif de présentation. Une prépublication n'a pas encore été relue par d'autres chercheurs : le récapitulatif le dit toujours explicitement.",
    scientificStatus: "preprint",
    sources: [{ url: "https://exemple.invalid/preprint", title: "Prépublication d'exemple" }],
    correction: null,
    developmentPostId: null,
  },
];

export default async function RecapPage() {
  const user = await getCurrentUser();
  const signedIn = Boolean(user?.onboarded);
  const [agent] = await db.query<{ id: string; handle: string }>(`SELECT id, handle FROM users WHERE role = 'agent' ORDER BY created_at LIMIT 1`);
  const { posts } = agent ? await listFeed({ view: "recent", authorId: agent.id, viewerId: user?.id, limit: 20 }) : { posts: [] };
  const following = user && agent
    ? (await db.query(`SELECT 1 FROM member_follows WHERE follower_id = $1 AND followee_id = $2`, [user.id, agent.id])).length > 0
    : false;
  const reactions = await reactionSummaries(db.query, posts.map((p) => p.id), user?.id ?? null);

  return (
    <div className="wide-page space-y-6">
      <header className="rounded-card bg-ink p-5 text-white sm:p-6">
        <p className="label-mono text-white/70">Le récap</p>
        <h1 className="mt-2 text-2xl font-bold sm:text-3xl">L’essentiel des sciences et de la tech, trois fois par semaine.</h1>
        <p className="mt-3 max-w-2xl text-white/85">
          Lundi, mercredi et vendredi à 7 h : une sélection de nouvelles en IA, robotique et espace, résumées fidèlement, avec leurs
          sources et leur statut. Chaque résumé est vérifié contre ses sources avant d’être publié.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          {agent && (
            <div className="rounded-card bg-white p-1">
              <FollowButton target="member" keyValue={agent.handle} initialFollowing={following} signedIn={signedIn} label="le récap" />
            </div>
          )}
          <p className="text-sm text-white/80">En suivant le récap, il remonte en tête de votre fil « Pour vous ».</p>
        </div>
      </header>

      {posts.length > 0 ? (
        <section aria-labelledby="recaps-publies">
          <h2 id="recaps-publies" className="mb-3 text-xl font-bold">Derniers récapitulatifs</h2>
          <ul className="space-y-3">
            {posts.map((post) => (
              <li key={post.id}>
                <PostCard post={post} reactions={reactions.get(post.id)} />
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_19rem]">
          <section className="card min-w-0 p-5 sm:p-6" aria-labelledby="exemple-recap">
            <p className="inline-block rounded-full bg-amber-100 px-3 py-1 label-mono text-amber-900">Exemple fictif — aperçu du format</p>
            <h2 id="exemple-recap" className="mt-3 text-2xl font-bold">À quoi ressemblera un récapitulatif</h2>
            <p className="mt-2 text-sm text-soft">Ces nouvelles n’existent pas : elles montrent seulement la présentation. Le premier vrai récap arrive bientôt.</p>
            <RecapArticle items={EXEMPLE} />
          </section>
          <aside className="space-y-4">
            <section className="card p-5">
              <h2 className="font-bold">Comment c’est fait</h2>
              <ol className="mt-3 list-inside list-decimal space-y-2 text-sm text-soft">
                <li>Collecte auprès de sources primaires vérifiées (laboratoires, agences, revues).</li>
                <li>Sélection et résumé par l’agent éditorial.</li>
                <li>Vérification indépendante de chaque phrase contre sa source.</li>
                <li>En cas de doute : la nouvelle est écartée, jamais inventée.</li>
              </ol>
            </section>
            <section className="card p-5">
              <h2 className="font-bold">Développer un sujet</h2>
              <p className="mt-2 text-sm text-soft">Une nouvelle vous intrigue ? Elle pourra être développée en article, et discutée dans un salon.</p>
              <Link href="/salons" className="btn-link mt-3 inline-block">Découvrir les salons →</Link>
            </section>
          </aside>
        </div>
      )}
    </div>
  );
}

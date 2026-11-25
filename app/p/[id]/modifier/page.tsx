import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getPost } from "@/lib/data/posts";
import { listActiveThemes } from "@/lib/data/themes";
import { PostForm } from "@/components/PostForm";

export const metadata: Metadata = { title: "Modifier la publication" };

export default async function EditPostPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) redirect(`/connexion?next=/p/${id}/modifier`);
  const post = await getPost(id);
  if (!post || post.status !== "published") notFound();
  if (post.authorId !== user.id) {
    return <p className="card p-5">Vous ne pouvez modifier que vos propres publications.</p>;
  }
  const themes = await listActiveThemes();
  return (
    <div className="wide-page space-y-5">
      <h1 className="text-2xl font-bold sm:text-[28px]">Modifier la publication</h1>
      <PostForm
        themes={themes}
        authorName={user.displayName ?? "Vous"}
        postId={post.id}
        initial={{
          kind: post.kind,
          title: post.title,
          body: post.body,
          sources: post.sources.length ? post.sources : [""],
          themeIds: post.themes.map((t) => t.id),
          demoUrl: post.demoUrl ?? "",
        }}
      />
    </div>
  );
}
